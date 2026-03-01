/**
 * POST /api/generate
 *
 * Generates a starter automation repository zip for any language + framework
 * combination using Claude to produce the project files.
 *
 * Max duration: 30s (set in vercel.json)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import JSZip from 'jszip';
import Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// Schema — open strings, not enums, so any language/framework is accepted
// ---------------------------------------------------------------------------
const GenerateSchema = z.object({
  language:     z.string().min(1).max(50),
  framework:    z.string().min(1).max(50),
  projectName:  z.string().min(1).max(100),
  orgSlug:      z.string().min(1),
  projectId:    z.string().uuid(),
  apiKey:       z.string().min(1),
  dashboardUrl: z.string().url(),
});

type GenerateInput = z.infer<typeof GenerateSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function generateQaDashboardYml(input: GenerateInput): string {
  return `# QACore dashboard configuration
# Safe to commit — contains no secrets.
# Set QA_PROJECT_KEY as a repository secret in GitHub.

dashboard_url: ${input.dashboardUrl}
org_slug: ${input.orgSlug}
project_id: ${input.projectId}
`;
}

// ---------------------------------------------------------------------------
// AI-based repo generation
// ---------------------------------------------------------------------------
async function generateWithAI(input: GenerateInput): Promise<Record<string, string>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `Generate a complete ${input.language} test automation repository using ${input.framework}.

Return ONLY a valid JSON object — no explanation, no markdown fences:
{"files": {"<relative-path>": "<file-content>", ...}}

Project name: ${input.projectName}

Include these files:
1. README.md — overview, prerequisites, local setup, how to run tests
2. .gitignore — appropriate for ${input.language} + ${input.framework}
3. All dependency/build files (package.json, pom.xml, requirements.txt, Gemfile, build.gradle.kts, *.csproj, etc.)
4. Framework configuration (playwright.config.ts, pytest.ini, testng.xml, cypress.config.ts, etc.)
5. Two example automation test files with at least 3 meaningful test cases each (use a public demo site like https://the-internet.herokuapp.com or httpbin.org as the target)
6. .github/workflows/ci.yml with these steps:
   - Checkout code
   - Set up ${input.language} environment
   - Install dependencies
   - Run ${input.framework} tests and output results as JUnit XML where possible
   - Always-run reporting step (if: always()):
       name: Report to QACore
       env:
         QA_PROJECT_KEY: \${{ secrets.QA_PROJECT_KEY }}
       run: |
         curl -s -X POST ${input.dashboardUrl}/api/reports \\
           -H "X-Project-Key: $QA_PROJECT_KEY" \\
           -F "results=@<actual-results-file-path>" \\
           -F "branch=\${{ github.ref_name }}" \\
           -F "commit_sha=\${{ github.sha }}" \\
           -F "triggered_by=ci"

Return the JSON object now:`;

  const message = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 8192,
    messages:   [{ role: 'user', content: prompt }],
  });

  const text = (message.content[0] as { type: string; text: string }).text.trim();

  // Strip any accidental markdown code fences
  const cleaned = text
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```$/m, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Last resort: extract the outermost JSON object
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI response did not contain valid JSON');
    parsed = JSON.parse(match[0]);
  }

  const result = parsed as { files?: Record<string, string> };
  if (!result.files || typeof result.files !== 'object') {
    throw new Error('AI response missing "files" object');
  }

  return result.files;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let input: GenerateInput;
  try {
    input = GenerateSchema.parse(req.body);
  } catch (err: unknown) {
    return res.status(400).json({
      error:   'Invalid request body',
      details: err instanceof Error ? err.message : String(err),
    });
  }

  // Generate repo files via AI
  let files: Record<string, string>;
  try {
    files = await generateWithAI(input);
  } catch (err) {
    console.error('AI generation failed', err);
    return res.status(500).json({ error: 'Repository generation failed. Please try again.' });
  }

  // Always inject the correct .qa-dashboard.yml (override AI version if any)
  files['.qa-dashboard.yml'] = generateQaDashboardYml(input);

  // Build zip
  const zip = new JSZip();
  const projectSlug = slugify(input.projectName);
  const root = zip.folder(projectSlug)!;

  for (const [filePath, content] of Object.entries(files)) {
    root.file(filePath, content);
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

  const filename = `${projectSlug}-starter.zip`;
  res.setHeader('Content-Type',        'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length',      zipBuffer.length);
  return res.status(200).send(zipBuffer);
}
