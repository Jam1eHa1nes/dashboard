import { useState } from 'react';
import { Download, Eye, EyeOff, Cpu } from 'lucide-react';
import { generateRepo }  from '../../lib/api';
import { useOrg }        from '../../contexts/OrgContext';
import { useProjects }   from '../../hooks/useProjects';
import { AppShell }      from '../../components/layout/AppShell';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button }        from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';

const LANGUAGES = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'java',       label: 'Java' },
  { value: 'python',     label: 'Python' },
  { value: 'csharp',     label: 'C#' },
  { value: 'ruby',       label: 'Ruby' },
  { value: 'kotlin',     label: 'Kotlin' },
];

const FRAMEWORKS: Record<string, { value: string; label: string }[]> = {
  typescript: [
    { value: 'playwright',   label: 'Playwright' },
    { value: 'cypress',      label: 'Cypress' },
    { value: 'webdriverio',  label: 'WebDriverIO' },
    { value: 'jest',         label: 'Jest' },
  ],
  javascript: [
    { value: 'playwright',   label: 'Playwright' },
    { value: 'cypress',      label: 'Cypress' },
    { value: 'webdriverio',  label: 'WebDriverIO' },
    { value: 'mocha',        label: 'Mocha' },
  ],
  java: [
    { value: 'selenium',     label: 'Selenium WebDriver' },
    { value: 'playwright',   label: 'Playwright for Java' },
    { value: 'serenity',     label: 'Serenity BDD' },
    { value: 'testng',       label: 'TestNG' },
    { value: 'junit5',       label: 'JUnit 5' },
    { value: 'cucumber',     label: 'Cucumber (Java)' },
  ],
  python: [
    { value: 'playwright',   label: 'Playwright' },
    { value: 'selenium',     label: 'Selenium WebDriver' },
    { value: 'pytest',       label: 'pytest' },
    { value: 'behave',       label: 'Behave (BDD)' },
    { value: 'robot',        label: 'Robot Framework' },
  ],
  csharp: [
    { value: 'playwright',   label: 'Playwright' },
    { value: 'selenium',     label: 'Selenium WebDriver' },
    { value: 'nunit',        label: 'NUnit' },
    { value: 'specflow',     label: 'SpecFlow (BDD)' },
  ],
  ruby: [
    { value: 'capybara',     label: 'Capybara + Selenium' },
    { value: 'cucumber',     label: 'Cucumber' },
    { value: 'rspec',        label: 'RSpec' },
  ],
  kotlin: [
    { value: 'selenium',     label: 'Selenium WebDriver' },
    { value: 'playwright',   label: 'Playwright' },
    { value: 'kotest',       label: 'Kotest' },
  ],
};

function getPreviewFiles(language: string, framework: string): string[] {
  const base = ['.github/workflows/ci.yml', '.gitignore', '.qa-dashboard.yml', 'README.md'];
  switch (language) {
    case 'typescript':
    case 'javascript': {
      const ext = language === 'typescript' ? 'ts' : 'js';
      return [`package.json`, `${framework}.config.${ext}`, `tests/example.spec.${ext}`, `tests/fixtures.${ext}`, ...base];
    }
    case 'java':
      return ['pom.xml', 'src/test/java/ExampleTest.java', 'src/test/resources/testng.xml', ...base];
    case 'python':
      return ['requirements.txt', 'pytest.ini', 'tests/test_example.py', 'tests/conftest.py', ...base];
    case 'csharp':
      return ['*.csproj', 'Tests/ExampleTest.cs', 'Tests/Fixtures.cs', ...base];
    case 'ruby':
      return ['Gemfile', 'spec/example_spec.rb', '.rspec', ...base];
    case 'kotlin':
      return ['build.gradle.kts', 'src/test/kotlin/ExampleTest.kt', ...base];
    default:
      return base;
  }
}

export default function RepoGenerator() {
  const { currentOrg } = useOrg();
  const { projects }   = useProjects(currentOrg?.id);

  const [projectName, setProjectName] = useState('');
  const [language,    setLanguage]    = useState('typescript');
  const [framework,   setFramework]   = useState('playwright');
  const [projectId,   setProjectId]   = useState('');
  const [apiKey,      setApiKey]      = useState('');
  const [showKey,     setShowKey]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [showPreview, setShowPreview] = useState(true);

  function handleLanguageChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const lang = e.target.value;
    setLanguage(lang);
    setFramework(FRAMEWORKS[lang]?.[0]?.value ?? '');
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrg || !projectId || !apiKey.trim() || !projectName.trim()) return;
    setLoading(true);
    setError('');

    try {
      const blob = await generateRepo({
        language,
        framework,
        projectName: projectName.trim(),
        orgSlug:     currentOrg.slug,
        projectId,
        apiKey:      apiKey.trim(),
        dashboardUrl: window.location.origin,
      });

      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${projectName.trim().toLowerCase().replace(/\s+/g, '-')}-starter.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }

  const frameworkOptions = FRAMEWORKS[language] ?? [];
  const previewFiles = getPreviewFiles(language, framework);

  return (
    <AppShell title="Automation Repo Generator">
      <div className="max-w-4xl">
        <div className="mb-6">
          <h2 className="font-heading text-xl font-semibold text-text mb-1">Automation repo generator</h2>
          <p className="text-sm text-muted">
            Generate a ready-to-use automation repository with tests, CI, and QACore reporting pre-configured.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <Card>
            <CardHeader><CardTitle>Configure</CardTitle></CardHeader>
            <form onSubmit={handleGenerate} className="space-y-4">
              <Input
                label="Project name"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder="My Automation Suite"
                required
              />
              <Select
                label="Language"
                value={language}
                onChange={handleLanguageChange}
                options={LANGUAGES}
              />
              <Select
                label="Automation framework"
                value={framework}
                onChange={e => setFramework(e.target.value)}
                options={frameworkOptions}
              />
              <Select
                label="Project"
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                options={[
                  { value: '', label: 'Select a project…' },
                  ...projects.map(p => ({ value: p.id, label: p.name })),
                ]}
                required
              />
              <div className="relative">
                <Input
                  label="API key"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="qac_••••••••"
                  required
                  hint="Go to your project → API endpoint card → Manage API keys"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(p => !p)}
                  className="absolute right-3 top-8 text-muted hover:text-text"
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              {error && <p className="text-xs text-error">{error}</p>}

              <Button
                type="submit"
                className="w-full"
                loading={loading}
                icon={<Download size={14} />}
                disabled={!projectName || !projectId || !apiKey}
              >
                {loading ? 'Generating…' : 'Generate & download zip'}
              </Button>
              {loading && (
                <p className="text-xs text-muted text-center">
                  Generating your repo with AI — this may take up to 30s.
                </p>
              )}
            </form>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Files included</CardTitle>
              <button
                onClick={() => setShowPreview(p => !p)}
                className="text-muted hover:text-text transition-colors"
              >
                {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </CardHeader>
            {showPreview && (
              <ul className="space-y-1.5">
                {previewFiles.map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted font-mono">
                    <Cpu size={10} className="text-accent shrink-0" />
                    {f}
                  </li>
                ))}
                <li className="flex items-center gap-2 text-xs text-muted/50 font-mono italic">
                  <Cpu size={10} className="shrink-0" />
                  + additional framework files…
                </li>
              </ul>
            )}
          </Card>
        </div>

        {/* Next steps */}
        <Card className="mt-6">
          <CardTitle className="mb-4">After downloading</CardTitle>
          <ol className="space-y-3 text-sm text-muted list-decimal list-inside">
            <li>Unzip and push to a new GitHub repository.</li>
            <li>
              Add <code className="text-accent bg-bg px-1 py-0.5 rounded text-xs">QA_PROJECT_KEY</code> as a
              repository secret in <strong className="text-text">Settings → Secrets and variables → Actions</strong>.
            </li>
            <li>Push a commit — the CI workflow will run tests and report results here automatically.</li>
            <li>
              To report manually:{' '}
              <code className="text-accent bg-bg px-1 py-0.5 rounded text-xs">
                curl -X POST {window.location.origin}/api/reports -H "X-Project-Key: $QA_PROJECT_KEY" -F "results=@test-results.xml"
              </code>
            </li>
          </ol>
        </Card>
      </div>
    </AppShell>
  );
}
