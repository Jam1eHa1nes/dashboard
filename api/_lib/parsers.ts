/**
 * Report format auto-detection and parsing.
 *
 * Supported formats:
 *   - JUnit XML     (filename ends in .xml, or starts with <?xml)
 *   - Jest/Mocha JSON
 *   - PyTest JSON
 *   - Generic JSON  ({ total, passed, failed, skipped, suites[] })
 */

import { XMLParser } from 'fast-xml-parser';

type TestRecord = {
  name: string;
  full_name?: string;
  state: 'passed' | 'failed' | 'skipped' | 'pending';
  duration_ms?: number;
  error_message?: string;
  error_stack?: string;
  retry_count?: number;
};

type SuiteRecord = {
  name: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration_ms?: number;
  tests: TestRecord[];
};

type ParsedReport = {
  framework?: string;
  branch?: string;
  commit_sha?: string;
  commit_message?: string;
  triggered_by?: 'ci' | 'manual' | 'api';
  total?: number;
  passed?: number;
  failed?: number;
  skipped?: number;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
  suites?: SuiteRecord[];
};

// ---------------------------------------------------------------------------
// JUnit XML parser
// ---------------------------------------------------------------------------
function parseJUnit(xml: string): ParsedReport {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const doc = parser.parse(xml);

  const rootSuites = doc.testsuites?.testsuite ?? doc.testsuite;
  const suiteArr: unknown[] = Array.isArray(rootSuites) ? rootSuites : rootSuites ? [rootSuites] : [];

  const suites: SuiteRecord[] = suiteArr.map((s: unknown) => {
    const suite = s as Record<string, unknown>;
    const casesRaw = suite.testcase ?? [];
    const cases: unknown[] = Array.isArray(casesRaw) ? casesRaw : [casesRaw];

    const tests: TestRecord[] = cases.map((c: unknown) => {
      const tc = c as Record<string, unknown>;
      const name      = String(tc['@_name'] ?? '');
      const className = String(tc['@_classname'] ?? '');
      const timeS     = parseFloat(String(tc['@_time'] ?? '0')) || 0;
      const failure   = tc.failure as Record<string, unknown> | undefined;
      const error_    = tc.error   as Record<string, unknown> | undefined;
      const skipped   = tc.skipped;

      let state: TestRecord['state'] = 'passed';
      let error_message: string | undefined;
      let error_stack: string | undefined;

      if (failure) {
        state = 'failed';
        error_message = String(failure['@_message'] ?? failure['#text'] ?? '');
        error_stack   = String(failure['#text'] ?? '');
      } else if (error_) {
        state = 'failed';
        error_message = String(error_['@_message'] ?? error_['#text'] ?? '');
        error_stack   = String(error_['#text'] ?? '');
      } else if (skipped !== undefined) {
        state = 'skipped';
      }

      return {
        name,
        full_name:     className ? `${className}.${name}` : name,
        state,
        duration_ms:   Math.round(timeS * 1000),
        error_message: error_message || undefined,
        error_stack:   error_stack   || undefined,
      };
    });

    const total   = parseInt(String(suite['@_tests']    ?? tests.length), 10) || tests.length;
    const failed  = parseInt(String(suite['@_failures'] ?? 0), 10)
                  + parseInt(String(suite['@_errors']   ?? 0), 10);
    const skippedCount = parseInt(String(suite['@_skipped'] ?? 0), 10);
    const passed  = total - failed - skippedCount;
    const timeS   = parseFloat(String(suite['@_time'] ?? '0')) || 0;

    return {
      name:        String(suite['@_name'] ?? 'Suite'),
      total,
      passed:      Math.max(0, passed),
      failed:      Math.max(0, failed),
      skipped:     Math.max(0, skippedCount),
      duration_ms: Math.round(timeS * 1000),
      tests,
    };
  });

  const total   = suites.reduce((s, su) => s + su.total,   0);
  const passed  = suites.reduce((s, su) => s + su.passed,  0);
  const failed  = suites.reduce((s, su) => s + su.failed,  0);
  const skipped = suites.reduce((s, su) => s + su.skipped, 0);
  const duration = suites.reduce((s, su) => s + (su.duration_ms ?? 0), 0);

  return { framework: 'junit', total, passed, failed, skipped, duration_ms: duration, suites };
}

// ---------------------------------------------------------------------------
// Jest JSON parser (--json output)
// ---------------------------------------------------------------------------
function parseJest(raw: Record<string, unknown>): ParsedReport {
  const suiteResults = (raw.testResults as unknown[]) ?? [];

  const suites: SuiteRecord[] = suiteResults.map((sr: unknown) => {
    const suite = sr as Record<string, unknown>;
    const assertionResults = (suite.assertionResults as unknown[]) ?? [];

    const tests: TestRecord[] = assertionResults.map((ar: unknown) => {
      const t = ar as Record<string, unknown>;
      const statusMap: Record<string, TestRecord['state']> = {
        passed:  'passed',
        failed:  'failed',
        pending: 'pending',
        skipped: 'skipped',
        todo:    'skipped',
      };
      const failureMessages = (t.failureMessages as string[]) ?? [];
      return {
        name:          String(t.title ?? ''),
        full_name:     (t.fullName as string) ?? undefined,
        state:         statusMap[t.status as string] ?? 'pending',
        duration_ms:   typeof t.duration === 'number' ? t.duration : undefined,
        error_message: failureMessages[0]?.split('\n')[0],
        error_stack:   failureMessages[0],
      };
    });

    const total   = tests.length;
    const failed  = tests.filter(t => t.state === 'failed').length;
    const skipped = tests.filter(t => t.state === 'skipped' || t.state === 'pending').length;
    const passed  = total - failed - skipped;
    const endTime   = (suite.endTime   as number) ?? 0;
    const startTime = (suite.startTime as number) ?? 0;

    return {
      name:        String(suite.testFilePath ?? suite.displayName ?? 'Suite'),
      total,
      passed,
      failed,
      skipped,
      duration_ms: endTime - startTime,
      tests,
    };
  });

  const total   = suites.reduce((s, su) => s + su.total,   0);
  const passed  = suites.reduce((s, su) => s + su.passed,  0);
  const failed  = suites.reduce((s, su) => s + su.failed,  0);
  const skipped = suites.reduce((s, su) => s + su.skipped, 0);

  return {
    framework:   'jest',
    total,
    passed,
    failed,
    skipped,
    duration_ms: typeof raw.testExecError === 'number'
      ? 0
      : ((raw.endTime as number) ?? 0) - ((raw.startTime as number) ?? 0),
    suites,
  };
}

// ---------------------------------------------------------------------------
// PyTest JSON parser (pytest-json-report output)
// ---------------------------------------------------------------------------
function parsePytest(raw: Record<string, unknown>): ParsedReport {
  const tests = (raw.tests as unknown[]) ?? [];

  // Group by nodeid parent
  const suiteMap = new Map<string, TestRecord[]>();

  for (const t of tests) {
    const test = t as Record<string, unknown>;
    const nodeId = String(test.nodeid ?? '');
    const suiteName = nodeId.split('::')[0] ?? 'root';
    const outcome   = String(test.outcome ?? 'unknown');
    const stateMap: Record<string, TestRecord['state']> = {
      passed:  'passed',
      failed:  'failed',
      error:   'failed',
      skipped: 'skipped',
      xfailed: 'skipped',
      xpassed: 'passed',
    };
    const call = (test.call as Record<string, unknown>) | undefined;
    const longrepr = (call as Record<string, unknown> | undefined)?.longrepr;

    const record: TestRecord = {
      name:          nodeId.split('::').slice(1).join('::') || nodeId,
      full_name:     nodeId,
      state:         stateMap[outcome] ?? 'pending',
      duration_ms:   typeof test.duration === 'number' ? Math.round(test.duration * 1000) : undefined,
      error_message: typeof longrepr === 'string' ? longrepr.split('\n').at(-1) : undefined,
      error_stack:   typeof longrepr === 'string' ? longrepr : undefined,
    };

    if (!suiteMap.has(suiteName)) suiteMap.set(suiteName, []);
    suiteMap.get(suiteName)!.push(record);
  }

  const suites: SuiteRecord[] = [...suiteMap.entries()].map(([name, ts]) => {
    const total   = ts.length;
    const failed  = ts.filter(t => t.state === 'failed').length;
    const skipped = ts.filter(t => t.state === 'skipped').length;
    const passed  = total - failed - skipped;
    return { name, total, passed, failed, skipped, tests: ts };
  });

  const summary = raw.summary as Record<string, number> | undefined;
  const durS = typeof raw.duration === 'number' ? raw.duration : 0;

  return {
    framework:   'pytest',
    total:       summary?.total   ?? suites.reduce((s, su) => s + su.total,   0),
    passed:      summary?.passed  ?? suites.reduce((s, su) => s + su.passed,  0),
    failed:      (summary?.failed ?? 0) + (summary?.error ?? 0),
    skipped:     summary?.skipped ?? suites.reduce((s, su) => s + su.skipped, 0),
    duration_ms: Math.round(durS * 1000),
    suites,
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
export function parseReport(
  fileBuffer: Buffer,
  filename: string,
  extraFields: Record<string, string> = {}
): ParsedReport {
  const content = fileBuffer.toString('utf-8').trim();
  const ext     = filename.split('.').pop()?.toLowerCase();

  // JUnit XML
  if (ext === 'xml' || content.startsWith('<?xml') || content.startsWith('<testsuites') || content.startsWith('<testsuite')) {
    return {
      ...parseJUnit(content),
      branch:         extraFields.branch,
      commit_sha:     extraFields.commit_sha,
      commit_message: extraFields.commit_message,
      triggered_by:   (extraFields.triggered_by as 'ci' | 'manual' | 'api') ?? 'api',
    };
  }

  // JSON formats
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error('File is not valid XML or JSON');
  }

  const base = {
    branch:         extraFields.branch,
    commit_sha:     extraFields.commit_sha,
    commit_message: extraFields.commit_message,
    triggered_by:   (extraFields.triggered_by as 'ci' | 'manual' | 'api') ?? 'api',
  };

  // Jest JSON: has testResults array
  if (Array.isArray(raw.testResults)) {
    return { ...base, ...parseJest(raw) };
  }

  // PyTest JSON: has tests array + summary
  if (Array.isArray(raw.tests) && raw.summary) {
    return { ...base, ...parsePytest(raw) };
  }

  // Generic JSON — pass through as-is
  return { ...base, ...raw } as ParsedReport;
}
