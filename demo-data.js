/**
 * demo-data.js
 *
 * Sample Allure result objects used by the "Load Demo" button.
 * Each object matches exactly what a real *-results.json file
 * from your test runner would contain.
 *
 * Structure mirrors: https://allurereport.org/docs/how-it-works/
 */

const DEMO_RESULTS = [

  // ── STAGING ───────────────────────────────────────────────

  {
    uuid: 'a1b2c3d4-0001',
    historyId: 'hist-001',
    name: 'User can log in with valid credentials',
    fullName: 'com.example.auth.LoginTest#validLogin',
    status: 'passed',
    start: Date.now() - 12000,
    stop: Date.now() - 10500,
    labels: [
      { name: 'tag',         value: '@core' },
      { name: 'tag',         value: '@smoke' },
      { name: 'suite',       value: 'Authentication' },
      { name: 'feature',     value: 'Login' },
      { name: 'environment', value: 'staging' },
    ],
    statusDetails: {},
    _env: 'staging',
  },

  {
    uuid: 'a1b2c3d4-0002',
    historyId: 'hist-002',
    name: 'User is redirected after logout',
    fullName: 'com.example.auth.LogoutTest#redirectAfterLogout',
    status: 'passed',
    start: Date.now() - 10000,
    stop: Date.now() - 9100,
    labels: [
      { name: 'tag',     value: '@core' },
      { name: 'suite',   value: 'Authentication' },
      { name: 'feature', value: 'Logout' },
    ],
    statusDetails: {},
    _env: 'staging',
  },

  {
    uuid: 'a1b2c3d4-0003',
    historyId: 'hist-003',
    name: 'Password reset email is sent',
    fullName: 'com.example.auth.PasswordResetTest#sendEmail',
    status: 'failed',
    start: Date.now() - 9000,
    stop: Date.now() - 8200,
    labels: [
      { name: 'tag',     value: '@core' },
      { name: 'suite',   value: 'Authentication' },
      { name: 'feature', value: 'Password Reset' },
    ],
    statusDetails: {
      message: 'Expected email to be sent within 5s but timed out after 10s',
      trace:   'java.lang.AssertionError: Expected email to be sent within 5s\n\tat com.example.auth.PasswordResetTest.sendEmail(PasswordResetTest.java:42)',
    },
    _env: 'staging',
  },

  {
    uuid: 'a1b2c3d4-0004',
    historyId: 'hist-004',
    name: 'Dashboard loads within 2 seconds',
    fullName: 'com.example.perf.DashboardPerfTest#loadTime',
    status: 'failed',
    start: Date.now() - 8000,
    stop: Date.now() - 5500,
    labels: [
      { name: 'tag',     value: '@performance' },
      { name: 'suite',   value: 'Performance' },
    ],
    statusDetails: {
      message: 'Expected load time < 2000ms but was 3241ms',
      trace:   'AssertionError: Expected: < 2000\n     but: was 3241',
    },
    _env: 'staging',
  },

  {
    uuid: 'a1b2c3d4-0005',
    historyId: 'hist-005',
    name: 'User profile page renders correctly',
    fullName: 'com.example.ui.ProfileTest#renderCheck',
    status: 'passed',
    start: Date.now() - 5000,
    stop: Date.now() - 3800,
    labels: [
      { name: 'tag',     value: '@core' },
      { name: 'suite',   value: 'User Profile' },
    ],
    statusDetails: {},
    _env: 'staging',
  },

  {
    uuid: 'a1b2c3d4-0006',
    historyId: 'hist-006',
    name: 'Cart item count updates in real-time',
    fullName: 'com.example.cart.CartTest#itemCountRealtime',
    status: 'broken',
    start: Date.now() - 3800,
    stop: Date.now() - 2900,
    labels: [
      { name: 'tag',     value: '@core' },
      { name: 'suite',   value: 'Shopping Cart' },
    ],
    statusDetails: {
      message: 'NullPointerException: cartService is null',
      trace:   'java.lang.NullPointerException: cartService is null\n\tat com.example.cart.CartTest.itemCountRealtime(CartTest.java:87)',
    },
    _env: 'staging',
  },

  {
    uuid: 'a1b2c3d4-0007',
    historyId: 'hist-007',
    name: 'Search returns results within 1 second',
    fullName: 'com.example.search.SearchTest#responseTime',
    status: 'passed',
    start: Date.now() - 2800,
    stop: Date.now() - 2100,
    labels: [
      { name: 'tag',   value: '@smoke' },
      { name: 'suite', value: 'Search' },
    ],
    statusDetails: {},
    _env: 'staging',
  },

  {
    uuid: 'a1b2c3d4-0008',
    historyId: 'hist-008',
    name: 'Checkout flow completes successfully',
    fullName: 'com.example.checkout.CheckoutTest#fullFlow',
    status: 'passed',
    start: Date.now() - 2000,
    stop: Date.now() - 600,
    labels: [
      { name: 'tag',   value: '@core' },
      { name: 'tag',   value: '@smoke' },
      { name: 'suite', value: 'Checkout' },
    ],
    statusDetails: {},
    _env: 'staging',
  },

  {
    uuid: 'a1b2c3d4-0009',
    historyId: 'hist-009',
    name: 'Invoice PDF is generated after purchase',
    fullName: 'com.example.checkout.InvoiceTest#pdfGeneration',
    status: 'skipped',
    start: Date.now() - 600,
    stop: Date.now() - 590,
    labels: [
      { name: 'tag',   value: '@billing' },
      { name: 'suite', value: 'Checkout' },
    ],
    statusDetails: { message: 'Skipped: PDF service not available in staging' },
    _env: 'staging',
  },

  {
    uuid: 'a1b2c3d4-0010',
    historyId: 'hist-010',
    name: 'Admin can delete a user account',
    fullName: 'com.example.admin.UserManagementTest#deleteUser',
    status: 'failed',
    start: Date.now() - 590,
    stop: Date.now() - 200,
    labels: [
      { name: 'tag',   value: '@admin' },
      { name: 'suite', value: 'Admin Panel' },
    ],
    statusDetails: {
      message: 'Expected 200 OK but received 403 Forbidden',
      trace:   'AssertionError: Expected status code 200 but was 403\n\tat com.example.admin.UserManagementTest.deleteUser(UserManagementTest.java:114)',
    },
    _env: 'staging',
  },

  // ── PRODUCTION ────────────────────────────────────────────

  {
    uuid: 'b2c3d4e5-0001',
    historyId: 'hist-001',
    name: 'User can log in with valid credentials',
    fullName: 'com.example.auth.LoginTest#validLogin',
    status: 'passed',
    start: Date.now() - 14000,
    stop: Date.now() - 12300,
    labels: [
      { name: 'tag',     value: '@core' },
      { name: 'tag',     value: '@smoke' },
      { name: 'suite',   value: 'Authentication' },
      { name: 'feature', value: 'Login' },
    ],
    statusDetails: {},
    _env: 'production',
  },

  {
    uuid: 'b2c3d4e5-0002',
    historyId: 'hist-002',
    name: 'User is redirected after logout',
    fullName: 'com.example.auth.LogoutTest#redirectAfterLogout',
    status: 'passed',
    start: Date.now() - 12000,
    stop: Date.now() - 11100,
    labels: [
      { name: 'tag',   value: '@core' },
      { name: 'suite', value: 'Authentication' },
    ],
    statusDetails: {},
    _env: 'production',
  },

  {
    uuid: 'b2c3d4e5-0003',
    historyId: 'hist-003',
    name: 'Password reset email is sent',
    fullName: 'com.example.auth.PasswordResetTest#sendEmail',
    status: 'passed',
    start: Date.now() - 11000,
    stop: Date.now() - 9500,
    labels: [
      { name: 'tag',   value: '@core' },
      { name: 'suite', value: 'Authentication' },
    ],
    statusDetails: {},
    _env: 'production',
  },

  {
    uuid: 'b2c3d4e5-0004',
    historyId: 'hist-004',
    name: 'Dashboard loads within 2 seconds',
    fullName: 'com.example.perf.DashboardPerfTest#loadTime',
    status: 'passed',
    start: Date.now() - 9000,
    stop: Date.now() - 7600,
    labels: [
      { name: 'tag',   value: '@performance' },
      { name: 'suite', value: 'Performance' },
    ],
    statusDetails: {},
    _env: 'production',
  },

  {
    uuid: 'b2c3d4e5-0005',
    historyId: 'hist-005',
    name: 'User profile page renders correctly',
    fullName: 'com.example.ui.ProfileTest#renderCheck',
    status: 'passed',
    start: Date.now() - 7500,
    stop: Date.now() - 6200,
    labels: [
      { name: 'tag',   value: '@core' },
      { name: 'suite', value: 'User Profile' },
    ],
    statusDetails: {},
    _env: 'production',
  },

  {
    uuid: 'b2c3d4e5-0006',
    historyId: 'hist-006',
    name: 'Cart item count updates in real-time',
    fullName: 'com.example.cart.CartTest#itemCountRealtime',
    status: 'passed',
    start: Date.now() - 6000,
    stop: Date.now() - 4800,
    labels: [
      { name: 'tag',   value: '@core' },
      { name: 'suite', value: 'Shopping Cart' },
    ],
    statusDetails: {},
    _env: 'production',
  },

  {
    uuid: 'b2c3d4e5-0007',
    historyId: 'hist-007',
    name: 'Search returns results within 1 second',
    fullName: 'com.example.search.SearchTest#responseTime',
    status: 'failed',
    start: Date.now() - 4700,
    stop: Date.now() - 3900,
    labels: [
      { name: 'tag',   value: '@smoke' },
      { name: 'suite', value: 'Search' },
    ],
    statusDetails: {
      message: 'Expected load time < 1000ms but was 1892ms',
      trace:   'AssertionError: Expected: < 1000\n     but: was 1892',
    },
    _env: 'production',
  },

  {
    uuid: 'b2c3d4e5-0008',
    historyId: 'hist-008',
    name: 'Checkout flow completes successfully',
    fullName: 'com.example.checkout.CheckoutTest#fullFlow',
    status: 'passed',
    start: Date.now() - 3800,
    stop: Date.now() - 1400,
    labels: [
      { name: 'tag',   value: '@core' },
      { name: 'tag',   value: '@smoke' },
      { name: 'suite', value: 'Checkout' },
    ],
    statusDetails: {},
    _env: 'production',
  },

  {
    uuid: 'b2c3d4e5-0009',
    historyId: 'hist-009',
    name: 'Invoice PDF is generated after purchase',
    fullName: 'com.example.checkout.InvoiceTest#pdfGeneration',
    status: 'passed',
    start: Date.now() - 1300,
    stop: Date.now() - 400,
    labels: [
      { name: 'tag',   value: '@billing' },
      { name: 'suite', value: 'Checkout' },
    ],
    statusDetails: {},
    _env: 'production',
  },

  {
    uuid: 'b2c3d4e5-0010',
    historyId: 'hist-010',
    name: 'Admin can delete a user account',
    fullName: 'com.example.admin.UserManagementTest#deleteUser',
    status: 'passed',
    start: Date.now() - 400,
    stop: Date.now() - 80,
    labels: [
      { name: 'tag',   value: '@admin' },
      { name: 'suite', value: 'Admin Panel' },
    ],
    statusDetails: {},
    _env: 'production',
  },
];

/**
 * Inject demo data directly into the dashboard state and render —
 * bypasses any S3 fetch entirely.
 */
function loadDemoData() {
  allResults = {};

  for (const raw of DEMO_RESULTS) {
    const env    = raw._env;
    const parsed = parseAllureResult(raw, env);
    if (!parsed) continue;

    if (!allResults[env]) allResults[env] = { results: [], error: null };
    allResults[env].results.push(parsed);
  }

  renderDashboard();

  document.getElementById('last-updated').textContent =
    `Demo data — ${new Date().toLocaleTimeString()}`;
}
