/**
 * dashboard.js
 *
 * Fetches Allure result JSON files from S3, parses them, and renders:
 *   1. Results-by-environment summary cards
 *   2. Failing tests table (status = failed | broken)
 *   3. Core tests table (tests tagged with config.coreTag)
 *
 * S3 path structure: {s3BaseUrl}/{env}/{project}/*.json
 *
 * S3 CORS must allow GET requests from the browser's origin.
 */

// ── State ─────────────────────────────────────────────────────
// { [envName]: { results: ParsedTest[], error: string|null } }
let allResults = {};

// ── Concurrency limit for parallel S3 fetches ─────────────────
const S3_BATCH_SIZE = 20;

// ═════════════════════════════════════════════════════════════
// S3 Fetching
// ═════════════════════════════════════════════════════════════

/**
 * List all JSON object keys under a given S3 prefix.
 * Handles S3 pagination via NextContinuationToken.
 */
async function listS3Objects(prefix) {
  const keys = [];
  let continuationToken = null;

  do {
    let url = `${config.s3BaseUrl}/?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=1000`;
    if (continuationToken) {
      url += `&continuation-token=${encodeURIComponent(continuationToken)}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `S3 listing returned ${response.status}. ` +
        `Check your S3 Base URL and ensure CORS is configured on the bucket.`
      );
    }

    const text = await response.text();
    const doc  = new DOMParser().parseFromString(text, 'text/xml');

    doc.querySelectorAll('Contents Key').forEach(el => {
      const key = el.textContent;
      if (key.endsWith('.json')) keys.push(key);
    });

    const next = doc.querySelector('NextContinuationToken');
    continuationToken = next ? next.textContent : null;
  } while (continuationToken);

  return keys;
}

/** Fetch and parse a single JSON file from S3. */
async function fetchJsonFromS3(key) {
  const response = await fetch(`${config.s3BaseUrl}/${key}`);
  if (!response.ok) throw new Error(`HTTP ${response.status} for key: ${key}`);
  return response.json();
}

/**
 * Load all test results for one environment.
 * Files are fetched in batches to avoid overwhelming the browser.
 */
async function fetchEnvironmentResults(env) {
  const prefix = `${env}/${config.project}/`;
  updateLoadingText(`Listing files for [${env}]…`);

  const keys = await listS3Objects(prefix);
  if (keys.length === 0) return [];

  const results = [];

  for (let i = 0; i < keys.length; i += S3_BATCH_SIZE) {
    const batch    = keys.slice(i, i + S3_BATCH_SIZE);
    const settled  = await Promise.allSettled(batch.map(fetchJsonFromS3));

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        const parsed = parseAllureResult(outcome.value, env);
        if (parsed) results.push(parsed);
      } else {
        console.warn('[Dashboard] Skipped file:', outcome.reason?.message);
      }
    }

    updateLoadingText(
      `Loading ${env}: ${Math.min(i + S3_BATCH_SIZE, keys.length)} / ${keys.length} files…`
    );
  }

  return results;
}

// ═════════════════════════════════════════════════════════════
// Allure Result Parsing
// ═════════════════════════════════════════════════════════════

/**
 * Transform a raw Allure result JSON into the shape the dashboard uses.
 * Returns null if the data doesn't look like a valid Allure result.
 */
function parseAllureResult(data, env) {
  if (!data || !data.status || !data.name) return null;

  const labels  = Array.isArray(data.labels) ? data.labels : [];
  const tags    = labels.filter(l => l.name === 'tag').map(l => l.value);
  const suite   = (
    labels.find(l => l.name === 'suite')?.value ||
    labels.find(l => l.name === 'parentSuite')?.value ||
    labels.find(l => l.name === 'feature')?.value ||
    ''
  );

  return {
    uuid:         data.uuid || '',
    name:         data.name,
    fullName:     data.fullName || data.name,
    status:       (data.status || 'unknown').toLowerCase(),  // passed | failed | broken | skipped
    environment:  env,
    tags,
    isCore:       tags.some(t => t.toLowerCase() === config.coreTag.toLowerCase()),
    errorMessage: data.statusDetails?.message || '',
    suite,
    duration:     (data.start && data.stop) ? (data.stop - data.start) : 0,
  };
}

// ═════════════════════════════════════════════════════════════
// Main Load Orchestration
// ═════════════════════════════════════════════════════════════

async function loadDashboard() {
  if (!config.s3BaseUrl) {
    document.getElementById('empty-state').classList.remove('hidden');
    document.getElementById('dashboard-content').classList.add('hidden');
    toggleConfig();
    return;
  }

  showLoading('Connecting to S3…');
  setRefreshBtnDisabled(true);

  try {
    // Load all environments in parallel; failures are isolated per-env
    const settled = await Promise.all(
      config.environments.map(env =>
        fetchEnvironmentResults(env)
          .then(results => ({ env, results, error: null }))
          .catch(err   => ({ env, results: [], error: err.message }))
      )
    );

    allResults = {};
    for (const { env, results, error } of settled) {
      allResults[env] = { results, error };
    }

    renderDashboard();

    document.getElementById('last-updated').textContent =
      `Updated ${new Date().toLocaleTimeString()}`;

  } catch (err) {
    // Unexpected top-level error
    console.error('[Dashboard]', err);
    showInlineError(`Unexpected error: ${err.message}`);
  } finally {
    hideLoading();
    setRefreshBtnDisabled(false);
  }
}

// ═════════════════════════════════════════════════════════════
// Rendering
// ═════════════════════════════════════════════════════════════

function renderDashboard() {
  document.getElementById('empty-state').classList.add('hidden');
  document.getElementById('dashboard-content').classList.remove('hidden');

  // Clear any previous inline errors
  document.getElementById('dashboard-content')
    .querySelectorAll('.error-inline-top').forEach(el => el.remove());

  renderEnvSummary();
  renderFailingTests();
  renderCoreTests();
}

// ── Environment Summary ───────────────────────────────────────

function renderEnvSummary() {
  const container = document.getElementById('env-summary');
  container.innerHTML = '';

  for (const [env, { results, error }] of Object.entries(allResults)) {
    const card = document.createElement('div');
    card.className = 'env-card' + (error ? ' has-error' : '');

    if (error) {
      card.innerHTML = `
        <div class="env-name">
          <span class="env-dot" style="background:var(--fail)"></span>
          ${escHtml(env)}
        </div>
        <div class="error-inline">${escHtml(error)}</div>
      `;
    } else {
      const total    = results.length;
      const passed   = results.filter(r => r.status === 'passed').length;
      const failed   = results.filter(r => r.status === 'failed' || r.status === 'broken').length;
      const skipped  = results.filter(r => r.status === 'skipped').length;
      const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
      const fillCls  = passRate >= 80 ? 'fill-high' : passRate >= 50 ? 'fill-medium' : 'fill-low';

      card.innerHTML = `
        <div class="env-name">
          <span class="env-dot" style="background:var(--accent)"></span>
          ${escHtml(env)}
        </div>
        <div class="env-stats">
          <div class="stat-total">
            <div class="stat-value">${total}</div>
            <div class="stat-label">Total</div>
          </div>
          <div class="stat-passed">
            <div class="stat-value">${passed}</div>
            <div class="stat-label">Passed</div>
          </div>
          <div class="stat-failed">
            <div class="stat-value">${failed}</div>
            <div class="stat-label">Failed</div>
          </div>
          <div class="stat-skip">
            <div class="stat-value">${skipped}</div>
            <div class="stat-label">Skipped</div>
          </div>
        </div>
        <div>
          <div class="pass-rate-label">
            <span>Pass rate</span><span>${passRate}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${fillCls}" style="width:${passRate}%"></div>
          </div>
        </div>
        <div class="env-file-count">${total} result${total !== 1 ? 's' : ''} loaded</div>
      `;
    }

    container.appendChild(card);
  }
}

// ── Environment Tabs (shared helper) ─────────────────────────

/**
 * Render an "All | ENV1 | ENV2 …" tab strip into the given container.
 * @param {string}   containerId  - ID of the <div class="env-tabs"> element
 * @param {string}   activeEnvKey - '' means All, otherwise an env name
 * @param {Function} onSelect     - called with the chosen env string ('' = All)
 */
function renderEnvTabs(containerId, activeEnvKey, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const envs = ['', ...config.environments];   // '' = "All" tab
  container.innerHTML = envs.map(env => {
    const label   = env || 'All';
    const isActive = env === activeEnvKey;
    return `<button class="env-tab${isActive ? ' active' : ''}" data-env="${escHtml(env)}">${escHtml(label)}</button>`;
  }).join('');

  container.querySelectorAll('.env-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const chosen = btn.dataset.env;
      container.querySelectorAll('.env-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onSelect(chosen);
    });
  });
}

// ── Failing Tests ─────────────────────────────────────────────

// Tracks which env tab is active for the failing section ('' = All)
window._failingActiveEnv = '';

function renderFailingTests() {
  const failing = getAllTests().filter(t => t.status === 'failed' || t.status === 'broken');

  document.getElementById('failing-count').textContent = failing.length;

  // Default to the first configured environment (e.g. QA)
  window._failingActiveEnv = config.environments[0] || '';
  renderEnvTabs('failing-tabs', window._failingActiveEnv, env => {
    window._failingActiveEnv = env;
    filterFailingTests();
  });

  window._failingTests = failing;
  filterFailingTests();
}

function filterFailingTests() {
  const search    = document.getElementById('failing-search').value.toLowerCase();
  const activeEnv = window._failingActiveEnv || '';

  const tests = (window._failingTests || []).filter(t => {
    const matchSearch = !search || (
      t.name.toLowerCase().includes(search) ||
      t.suite.toLowerCase().includes(search) ||
      t.errorMessage.toLowerCase().includes(search)
    );
    const matchEnv = !activeEnv || t.environment === activeEnv;
    return matchSearch && matchEnv;
  });

  const tbody = document.getElementById('failing-tbody');
  const empty = document.getElementById('failing-empty');

  if (tests.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    tbody.innerHTML = tests.map(t => `
      <tr>
        <td class="cell-name">
          <div class="test-name" title="${escHtml(t.fullName)}">${escHtml(t.name)}</div>
          ${t.suite ? `<div class="test-suite">${escHtml(t.suite)}</div>` : ''}
        </td>
        <td><span class="env-tag">${escHtml(t.environment)}</span></td>
        <td><span class="status-pill ${t.status}">${t.status}</span></td>
        <td class="error-cell">
          <div class="error-msg" title="${escHtml(t.errorMessage)}">
            ${escHtml(t.errorMessage) || '<span style="color:var(--text-muted)">—</span>'}
          </div>
        </td>
      </tr>
    `).join('');
  }
}

// ── Core Tests ────────────────────────────────────────────────

// Tracks which env tab is active for the core section ('' = All)
window._coreActiveEnv = '';

function renderCoreTests() {
  const coreTests = getAllTests().filter(t => t.isCore);

  document.getElementById('core-count').textContent     = coreTests.length;
  document.getElementById('core-tag-label').textContent = config.coreTag;

  window._coreActiveEnv = config.environments[0] || '';
  renderEnvTabs('core-tabs', window._coreActiveEnv, env => {
    window._coreActiveEnv = env;
    filterCoreTests();
  });

  window._coreTests = coreTests;
  filterCoreTests();
}

function filterCoreTests() {
  const search       = document.getElementById('core-search').value.toLowerCase();
  const statusFilter = document.getElementById('core-status-filter').value;
  const activeEnv    = window._coreActiveEnv || '';

  const tests = (window._coreTests || []).filter(t => {
    const matchSearch = !search || t.name.toLowerCase().includes(search);
    const matchStatus = !statusFilter || t.status === statusFilter;
    const matchEnv    = !activeEnv || t.environment === activeEnv;
    return matchSearch && matchStatus && matchEnv;
  });

  const tbody = document.getElementById('core-tbody');
  const empty = document.getElementById('core-empty');

  if (tests.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    tbody.innerHTML = tests.map(t => `
      <tr>
        <td class="cell-name">
          <div class="test-name" title="${escHtml(t.fullName)}">${escHtml(t.name)}</div>
          ${t.suite ? `<div class="test-suite">${escHtml(t.suite)}</div>` : ''}
        </td>
        <td><span class="env-tag">${escHtml(t.environment)}</span></td>
        <td><span class="status-pill ${t.status}">${t.status}</span></td>
        <td><span class="duration">${fmtDuration(t.duration)}</span></td>
      </tr>
    `).join('');
  }
}

// ═════════════════════════════════════════════════════════════
// UI Helpers
// ═════════════════════════════════════════════════════════════

function showLoading(text) {
  document.getElementById('loading-overlay').classList.remove('hidden');
  document.getElementById('loading-text').textContent = text || 'Loading…';
}

function hideLoading() {
  document.getElementById('loading-overlay').classList.add('hidden');
}

function updateLoadingText(text) {
  const el = document.getElementById('loading-text');
  if (el) el.textContent = text;
}

function setRefreshBtnDisabled(disabled) {
  document.getElementById('refresh-btn').disabled = disabled;
}

function showInlineError(message) {
  const div = document.createElement('div');
  div.className = 'error-inline error-inline-top';
  div.style.marginBottom = '20px';
  div.textContent = `Error: ${message}`;

  const content = document.getElementById('dashboard-content');
  content.classList.remove('hidden');
  document.getElementById('empty-state').classList.add('hidden');
  content.prepend(div);
}

// ═════════════════════════════════════════════════════════════
// Utilities
// ═════════════════════════════════════════════════════════════

/** Return all parsed tests across every loaded environment. */
function getAllTests() {
  return Object.values(allResults).flatMap(({ results }) => results ?? []);
}

/** Escape a string for safe insertion into HTML. */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Format a millisecond duration into a human-readable string. */
function fmtDuration(ms) {
  if (!ms || ms <= 0) return '—';
  if (ms < 1000)      return `${ms}ms`;
  if (ms < 60_000)    return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

// ═════════════════════════════════════════════════════════════
// Initialisation
// ═════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Require a valid session — redirects to login.html if not signed in
  const session = await requireAuth();
  if (!session) return;

  // 2. Show signed-in user in the header
  showUserInfo();

  // 3. Load centralised config (settings.json + localStorage overrides)
  await loadConfig();

  // 4. Sync UI labels
  const label = document.getElementById('core-tag-label');
  if (label) label.textContent = config.coreTag;

  // 5. Start auto-refresh timer
  setupAutoRefresh();

  // 6. Auto-load if S3 is configured
  if (config.s3BaseUrl) {
    loadDashboard();
  }
});
