/**
 * config.js
 *
 * Configuration priority (highest → lowest):
 *   1. settings.json  — committed to the repo, applies to ALL users
 *   2. localStorage   — local overrides via the Configure panel (dev/debug only)
 *   3. DEFAULT_CONFIG — hardcoded fallbacks
 *
 * To change the S3 location for everyone: update settings.json and push to GitHub.
 * Vercel redeploys automatically and all users get the new config on next page load.
 */

const DEFAULT_CONFIG = {
  s3BaseUrl:       '',
  environments:    ['qa', 'pp'],
  project:         '',
  coreTag:         '@core',
  refreshInterval: 0
};

let config = { ...DEFAULT_CONFIG };

/**
 * Fetch settings.json (centralised server config) and merge with
 * any local localStorage overrides. Called once on DOMContentLoaded.
 */
async function loadConfig() {
  // 1. Try fetching the centralised settings.json
  try {
    const res      = await fetch('settings.json?_=' + Date.now()); // bust cache
    const settings = await res.json();
    config = { ...DEFAULT_CONFIG, ...settings };
  } catch (e) {
    console.warn('[Dashboard] Could not load settings.json, using defaults:', e);
    config = { ...DEFAULT_CONFIG };
  }

  // 2. Apply any localStorage overrides on top (only non-empty values)
  try {
    const stored = localStorage.getItem('dashboard-config');
    if (stored) {
      const local = JSON.parse(stored);
      // Only override fields that are explicitly set locally and settings.json left blank
      if (!config.s3BaseUrl  && local.s3BaseUrl)  config.s3BaseUrl  = local.s3BaseUrl;
      if (!config.project    && local.project)    config.project    = local.project;
      if (local.coreTag)         config.coreTag         = local.coreTag;
      if (local.refreshInterval) config.refreshInterval = local.refreshInterval;
    }
  } catch (e) {
    console.warn('[Dashboard] Could not read localStorage config:', e);
  }

  return config;
}

/**
 * Save the config form values to localStorage (local override only).
 * To update for all users, edit settings.json and push to GitHub instead.
 */
function saveConfig() {
  const raw = {
    s3BaseUrl:       document.getElementById('cfg-s3-url').value.trim().replace(/\/+$/, ''),
    project:         document.getElementById('cfg-project').value.trim(),
    environments:    document.getElementById('cfg-environments').value
                       .split(',').map(e => e.trim()).filter(Boolean),
    coreTag:         document.getElementById('cfg-core-tag').value.trim() || '@core',
    refreshInterval: parseInt(document.getElementById('cfg-refresh-interval').value, 10) || 0,
  };

  if (!raw.s3BaseUrl) { alert('Please enter an S3 Base URL.'); return; }
  if (!raw.environments.length) { alert('Please enter at least one environment.'); return; }

  config = raw;
  localStorage.setItem('dashboard-config', JSON.stringify(config));

  const label = document.getElementById('core-tag-label');
  if (label) label.textContent = config.coreTag;

  setupAutoRefresh();
  toggleConfig();
  loadDashboard();
}

function populateConfigForm() {
  document.getElementById('cfg-s3-url').value          = config.s3BaseUrl;
  document.getElementById('cfg-project').value          = config.project;
  document.getElementById('cfg-environments').value     = config.environments.join(', ');
  document.getElementById('cfg-core-tag').value         = config.coreTag;
  document.getElementById('cfg-refresh-interval').value = config.refreshInterval;
}

function toggleConfig() {
  const panel  = document.getElementById('config-panel');
  const hidden = panel.classList.contains('hidden');
  if (hidden) populateConfigForm();
  panel.classList.toggle('hidden');
}

// ── Auto-refresh ──────────────────────────────────────────────
let _autoRefreshTimer = null;

function setupAutoRefresh() {
  if (_autoRefreshTimer) clearInterval(_autoRefreshTimer);
  if (config.refreshInterval > 0) {
    _autoRefreshTimer = setInterval(loadDashboard, config.refreshInterval * 60 * 1000);
  }
}
