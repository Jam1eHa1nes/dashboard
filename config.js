/**
 * config.js
 *
 * Manages dashboard configuration. Settings are persisted in localStorage
 * so they survive page refreshes.
 *
 * S3 path structure expected:
 *   {s3BaseUrl}/{env}/{project}/*.json
 */

const DEFAULT_CONFIG = {
  s3BaseUrl:       '',           // e.g. https://my-bucket.s3.us-east-1.amazonaws.com
  environments:    ['staging', 'production'],
  project:         'my-project',
  coreTag:         '@core',
  refreshInterval: 0             // minutes; 0 = disabled
};

// Active config (merged with defaults on load)
let config = { ...DEFAULT_CONFIG };

/**
 * Load config from localStorage and merge with defaults.
 * Called once on startup.
 */
function loadConfig() {
  try {
    const stored = localStorage.getItem('dashboard-config');
    if (stored) {
      config = { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn('[Dashboard] Could not read config from localStorage:', e);
  }
  return config;
}

/**
 * Read values from the config form, persist to localStorage,
 * then trigger a dashboard reload.
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

  // Validate
  if (!raw.s3BaseUrl) {
    alert('Please enter an S3 Base URL.');
    return;
  }
  if (raw.environments.length === 0) {
    alert('Please enter at least one environment name.');
    return;
  }

  config = raw;
  localStorage.setItem('dashboard-config', JSON.stringify(config));

  // Update the @core label in the header
  const label = document.getElementById('core-tag-label');
  if (label) label.textContent = config.coreTag;

  setupAutoRefresh();
  toggleConfig();
  loadDashboard();
}

/**
 * Populate the config form fields from the current config object.
 */
function populateConfigForm() {
  document.getElementById('cfg-s3-url').value          = config.s3BaseUrl;
  document.getElementById('cfg-project').value          = config.project;
  document.getElementById('cfg-environments').value     = config.environments.join(', ');
  document.getElementById('cfg-core-tag').value         = config.coreTag;
  document.getElementById('cfg-refresh-interval').value = config.refreshInterval;
}

/** Toggle the config panel open/closed. */
function toggleConfig() {
  const panel = document.getElementById('config-panel');
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

// Bootstrap on script load
loadConfig();
