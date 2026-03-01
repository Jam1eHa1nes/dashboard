# QACore

**Test intelligence for engineering teams.** QACore is a multi-tenant SaaS dashboard that aggregates test results from all your CI pipelines, giving you organisation-wide visibility into test health, trends, and flakiness — with zero code changes to your existing tests.

---

## What problem does it solve?

Most teams have test results scattered across CI logs. QACore gives you:

- **One dashboard** for all projects and branches
- **Pass rate trends** over time so regressions are caught early
- **Flakiness detection** across runs
- **Org-level health heatmap** at a glance
- **Real-time updates** via Supabase Realtime when CI finishes
- **Starter repo generator** — spin up a new project with tests + CI reporting in 30 seconds

---

## Architecture

```
                ┌─────────────────────────────────────────┐
                │              Browser (React)             │
                │  React Router v6 · Recharts · Tailwind   │
                └──────────────┬──────────────────────────┘
                               │ HTTPS
              ┌────────────────▼────────────────────┐
              │          Vercel (Edge/Serverless)    │
              │  /api/reports   — CI webhook ingest  │
              │  /api/generate  — Repo zip generator │
              │  /api/invitations — Invite emails    │
              └────────────────┬────────────────────┘
                               │ Supabase JS SDK (service role)
              ┌────────────────▼────────────────────┐
              │              Supabase                │
              │  Postgres + RLS + Auth + Realtime    │
              │  organisations, projects, runs,      │
              │  suites, test_results, audit_log     │
              └─────────────────────────────────────┘

  CI Pipeline ──► POST /api/reports  (X-Project-Key header)
                         │
                   validate_api_key()  [SECURITY DEFINER fn]
                         │
                   Insert run → suites → test_results
```

---

## Quick start

### 1. Clone & install

```bash
git clone https://github.com/your-org/qacore
cd qacore
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migration in the Supabase SQL editor:

```bash
# Paste the contents of supabase/migrations/001_initial_schema.sql
```

3. Enable GitHub OAuth: **Authentication → Providers → GitHub**.
4. Copy your project URL and keys from **Settings → API**.

### 3. Configure environment

```bash
cp .env.example .env
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

### 4. Run locally

```bash
npm run dev          # Vite dev server on :5173
vercel dev           # Vercel functions on :3001 (proxied via vite.config.ts)
```

### 5. Deploy to Vercel

```bash
vercel deploy --prod
```

Add all environment variables from `.env.example` in the Vercel project dashboard.

---

## Posting reports manually

```bash
curl -X POST https://your-app.vercel.app/api/reports \
  -H "X-Project-Key: qac_your_api_key" \
  -F "results=@test-results.xml" \
  -F "branch=main" \
  -F "commit_sha=abc1234" \
  -F "triggered_by=manual"
```

Or with JSON:

```bash
curl -X POST https://your-app.vercel.app/api/reports \
  -H "X-Project-Key: qac_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "branch": "main",
    "triggered_by": "manual",
    "total": 42,
    "passed": 40,
    "failed": 2,
    "skipped": 0,
    "suites": [
      {
        "name": "Auth tests",
        "total": 10,
        "passed": 9,
        "failed": 1,
        "skipped": 0,
        "tests": [
          {
            "name": "login with valid credentials",
            "state": "passed",
            "duration_ms": 120
          },
          {
            "name": "login with expired token",
            "state": "failed",
            "duration_ms": 45,
            "error_message": "Expected 200, got 401"
          }
        ]
      }
    ]
  }'
```

---

## Environment variables

| Variable                  | Required | Description |
|---------------------------|----------|-------------|
| `VITE_SUPABASE_URL`       | Yes      | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY`  | Yes      | Supabase anon/public key (safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes    | Service role key — server-side only, never expose to browser |
| `VITE_APP_URL`            | Yes      | Your deployed URL, used for deep-link generation |
| `ANTHROPIC_API_KEY`       | Optional | Used by `/api/generate` for Java/Ruby version lookup |
| `RESEND_API_KEY`          | Optional | If set, invitation emails are sent via Resend |

---

## Report format specification

### Generic JSON (recommended for custom integrations)

```json
{
  "framework":      "string (optional)",
  "branch":         "string (optional)",
  "commit_sha":     "string (optional)",
  "commit_message": "string (optional)",
  "triggered_by":   "ci | manual | api",
  "total":          42,
  "passed":         40,
  "failed":         2,
  "skipped":        0,
  "duration_ms":    12500,
  "metadata":       {},
  "suites": [
    {
      "name":        "string",
      "total":       10,
      "passed":      9,
      "failed":      1,
      "skipped":     0,
      "duration_ms": 3000,
      "tests": [
        {
          "name":          "string",
          "full_name":     "string (optional)",
          "state":         "passed | failed | skipped | pending",
          "duration_ms":   120,
          "error_message": "string (optional)",
          "error_stack":   "string (optional)",
          "retry_count":   0
        }
      ]
    }
  ]
}
```

### Auto-detected formats

| Format | Detection |
|--------|-----------|
| **JUnit XML** | `.xml` extension, or starts with `<?xml` / `<testsuites` |
| **Jest JSON** | JSON with `testResults` array |
| **pytest JSON** | JSON with `tests` array + `summary` object |
| **Generic JSON** | Anything else matching the schema above |

---

## Repo generator

The generator (`/org/:slug/generate`) creates a ready-to-use zip containing:

| File | Purpose |
|------|---------|
| `README.md` | Setup instructions + badge |
| `.gitignore` | Language-appropriate ignores |
| `Dockerfile` | Multi-stage build (test → production) |
| `.github/workflows/ci.yml` | Install → test → report to QACore |
| `src/` | Hello world + sample test |
| `.qa-dashboard.yml` | Dashboard URL + project ID (no secrets) |

The CI workflow's final step posts results automatically:

```yaml
- name: Report to QACore
  if: always()
  env:
    QA_PROJECT_KEY: ${{ secrets.QA_PROJECT_KEY }}
  run: |
    curl -s -X POST ${{ env.DASHBOARD_URL }}/api/reports \
      -H "X-Project-Key: $QA_PROJECT_KEY" \
      -F "results=@test-results.xml" \
      -F "branch=${{ github.ref_name }}" \
      -F "commit_sha=${{ github.sha }}"
```

Supported languages: **Node.js**, **Python**, **Go**, **Java**, **Ruby**

---

## Multi-tenancy & security

- Every resource (project, run, API key) has an `org_id` column.
- Supabase **Row Level Security** policies enforce org isolation at the database level — a query from org A can never return data from org B.
- API keys are stored as **SHA-256 hashes** — the plaintext key is shown only once at creation time.
- The `validate_api_key()` function runs as `SECURITY DEFINER` so CI pipelines can authenticate without being org members.
- The service role key is used only in Vercel serverless functions, never exposed to the browser.

---

## Contribution guide

1. Fork the repo and create a feature branch.
2. Run `npm run typecheck` and `npm run lint` before pushing.
3. Migrations go in `supabase/migrations/` — number sequentially (`002_...`).
4. API routes go in `api/` — validate all inputs with Zod.
5. Submit a PR against `main`.
