/**
 * POST /api/reports
 *
 * CI pipeline hook. Accepts test results via multipart/form-data (JUnit XML file)
 * or application/json. Auto-detects format, writes to Supabase, returns run ID
 * and deep-link URL.
 *
 * Auth: X-Project-Key header → SHA-256 → validate_api_key()
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'crypto';
import { z } from 'zod';
import Busboy from 'busboy';
import { adminSupabase } from './_lib/supabase';
import { parseReport } from './_lib/parsers';

// ---------------------------------------------------------------------------
// Input schema for JSON body
// ---------------------------------------------------------------------------
const JsonBodySchema = z.object({
  framework:      z.string().optional(),
  branch:         z.string().optional(),
  commit_sha:     z.string().optional(),
  commit_message: z.string().optional(),
  triggered_by:   z.enum(['ci', 'manual', 'api']).default('api'),
  total:          z.number().int().min(0).optional(),
  passed:         z.number().int().min(0).optional(),
  failed:         z.number().int().min(0).optional(),
  skipped:        z.number().int().min(0).optional(),
  duration_ms:    z.number().int().optional(),
  metadata:       z.record(z.unknown()).optional(),
  suites:         z.array(
    z.object({
      name:        z.string(),
      total:       z.number().int().min(0).default(0),
      passed:      z.number().int().min(0).default(0),
      failed:      z.number().int().min(0).default(0),
      skipped:     z.number().int().min(0).default(0),
      duration_ms: z.number().int().optional(),
      tests:       z.array(
        z.object({
          name:          z.string(),
          full_name:     z.string().optional(),
          state:         z.enum(['passed', 'failed', 'skipped', 'pending']),
          duration_ms:   z.number().int().optional(),
          error_message: z.string().optional(),
          error_stack:   z.string().optional(),
          retry_count:   z.number().int().default(0),
        })
      ).default([]),
    })
  ).optional(),
}).passthrough();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

async function readMultipart(req: VercelRequest): Promise<{
  fields: Record<string, string>;
  fileBuffer: Buffer | null;
  filename: string | null;
}> {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers as Record<string, string> });
    const fields: Record<string, string> = {};
    let fileBuffer: Buffer | null = null;
    let filename: string | null = null;
    const chunks: Buffer[] = [];

    bb.on('file', (_fieldname, file, info) => {
      filename = info.filename;
      file.on('data', (data: Buffer) => chunks.push(data));
      file.on('end', () => { fileBuffer = Buffer.concat(chunks); });
    });

    bb.on('field', (name, val) => { fields[name] = val; });
    bb.on('finish', () => resolve({ fields, fileBuffer, filename }));
    bb.on('error', reject);

    req.pipe(bb);
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Authenticate via API key -----------------------------------------------
  const rawKey = req.headers['x-project-key'];
  if (!rawKey || typeof rawKey !== 'string') {
    return res.status(401).json({ error: 'Missing X-Project-Key header' });
  }

  const keyHash = sha256(rawKey);

  const { data: keyRows, error: keyErr } = await adminSupabase.rpc(
    'validate_api_key',
    { p_key_hash: keyHash }
  );

  if (keyErr || !keyRows || keyRows.length === 0) {
    return res.status(401).json({ error: 'Invalid or revoked API key' });
  }

  const { org_id: orgId, project_id: projectId } = keyRows[0];

  // 2. Parse body -------------------------------------------------------------
  let parsed: z.infer<typeof JsonBodySchema>;
  const contentType = req.headers['content-type'] ?? '';

  try {
    if (contentType.includes('multipart/form-data')) {
      const { fields, fileBuffer, filename } = await readMultipart(req);
      if (!fileBuffer) {
        return res.status(400).json({ error: 'No results file in multipart body' });
      }
      parsed = parseReport(fileBuffer, filename ?? 'results', fields);
    } else {
      const bodyStr = typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body);
      const raw = JSON.parse(bodyStr);
      parsed = JsonBodySchema.parse(raw);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(400).json({ error: `Failed to parse report: ${msg}` });
  }

  // 3. Compute run-level totals if not provided --------------------------------
  const suites = parsed.suites ?? [];
  const total   = parsed.total   ?? suites.reduce((s, su) => s + su.total,   0);
  const passed  = parsed.passed  ?? suites.reduce((s, su) => s + su.passed,  0);
  const failed  = parsed.failed  ?? suites.reduce((s, su) => s + su.failed,  0);
  const skipped = parsed.skipped ?? suites.reduce((s, su) => s + su.skipped, 0);

  // 4. Insert run -------------------------------------------------------------
  const { data: runRow, error: runErr } = await adminSupabase
    .from('runs')
    .insert({
      project_id:     projectId,
      org_id:         orgId,
      framework:      parsed.framework,
      branch:         parsed.branch,
      commit_sha:     parsed.commit_sha,
      commit_message: parsed.commit_message,
      triggered_by:   parsed.triggered_by ?? 'api',
      total,
      passed,
      failed,
      skipped,
      duration_ms:    parsed.duration_ms,
      metadata:       (parsed.metadata as object) ?? {},
    })
    .select('id')
    .single();

  if (runErr || !runRow) {
    console.error('run insert error', runErr);
    return res.status(500).json({ error: 'Failed to create run' });
  }

  const runId = runRow.id;

  // 5. Insert suites + test_results ------------------------------------------
  for (const suite of suites) {
    const { data: suiteRow, error: suiteErr } = await adminSupabase
      .from('suites')
      .insert({
        run_id:      runId,
        org_id:      orgId,
        name:        suite.name,
        total:       suite.total,
        passed:      suite.passed,
        failed:      suite.failed,
        skipped:     suite.skipped,
        duration_ms: suite.duration_ms,
      })
      .select('id')
      .single();

    if (suiteErr || !suiteRow) {
      console.error('suite insert error', suiteErr);
      continue;
    }

    const testRows = suite.tests.map((t) => ({
      suite_id:      suiteRow.id,
      run_id:        runId,
      org_id:        orgId,
      name:          t.name,
      full_name:     t.full_name,
      state:         t.state,
      duration_ms:   t.duration_ms,
      error_message: t.error_message,
      error_stack:   t.error_stack,
      retry_count:   t.retry_count ?? 0,
    }));

    if (testRows.length > 0) {
      const { error: testErr } = await adminSupabase
        .from('test_results')
        .insert(testRows);
      if (testErr) console.error('test_results insert error', testErr);
    }
  }

  // 6. Audit log -------------------------------------------------------------
  await adminSupabase.from('audit_log').insert({
    org_id:   orgId,
    action:   'ingest_report',
    metadata: { run_id: runId, project_id: projectId, total, passed, failed, skipped },
  });

  // 7. Return run ID + deep-link ---------------------------------------------
  const dashboardUrl = process.env.VITE_APP_URL ?? 'https://your-app.vercel.app';
  const { data: project } = await adminSupabase
    .from('projects')
    .select('slug, organisations(slug)')
    .eq('id', projectId)
    .single() as { data: { slug: string; organisations: { slug: string } | null } | null };

  const orgSlug = project?.organisations?.slug ?? orgId;
  const deepLink = `${dashboardUrl}/org/${orgSlug}/projects/${projectId}/runs/${runId}`;

  return res.status(201).json({ run_id: runId, url: deepLink });
}
