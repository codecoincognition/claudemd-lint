/**
 * Generator module — scans a project and generates a CLAUDE.md from what it finds.
 *
 * Detects: package manager, languages, frameworks, build/test/lint commands,
 * directory structure, coding conventions, CI/CD, and deployment.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, basename, join } from "node:path";

export interface GeneratorResult {
  content: string;
  detections: Detection[];
  summary: string;
}

export interface Detection {
  category: string;
  detail: string;
}

interface ProjectInfo {
  name: string;
  language: string[];
  packageManager: string | null;
  frameworks: string[];
  buildCommand: string | null;
  testCommand: string | null;
  testFramework: string | null;
  lintCommand: string | null;
  devCommand: string | null;
  formatter: string | null;
  linter: string | null;
  directories: DirEntry[];
  ciProvider: string | null;
  ciFile: string | null;
  deployTarget: string | null;
  indentation: { style: string; size: number } | null;
  quoteStyle: string | null;
  semicolons: boolean | null;
  hasDocker: boolean;
  hasPrisma: boolean;
  database: string | null;
  envFiles: string[];
  conventions: string[];
}

interface DirEntry {
  name: string;
  description: string;
}

// ── Scanners ──────────────────────────────────────────────────────────

function readJson(path: string): any | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function detectPackageManager(rootDir: string): string | null {
  if (existsSync(resolve(rootDir, "bun.lockb")) || existsSync(resolve(rootDir, "bun.lock")))
    return "bun";
  if (existsSync(resolve(rootDir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(resolve(rootDir, "yarn.lock"))) return "yarn";
  if (existsSync(resolve(rootDir, "package-lock.json"))) return "npm";
  if (existsSync(resolve(rootDir, "package.json"))) return "npm";
  return null;
}

function detectLanguages(rootDir: string): string[] {
  const langs: Set<string> = new Set();

  if (existsSync(resolve(rootDir, "tsconfig.json"))) langs.add("TypeScript");
  if (existsSync(resolve(rootDir, "package.json"))) langs.add("JavaScript");
  if (existsSync(resolve(rootDir, "pyproject.toml")) || existsSync(resolve(rootDir, "setup.py")) || existsSync(resolve(rootDir, "requirements.txt")))
    langs.add("Python");
  if (existsSync(resolve(rootDir, "Cargo.toml"))) langs.add("Rust");
  if (existsSync(resolve(rootDir, "go.mod"))) langs.add("Go");
  if (existsSync(resolve(rootDir, "pom.xml")) || existsSync(resolve(rootDir, "build.gradle")))
    langs.add("Java");
  if (existsSync(resolve(rootDir, "Gemfile"))) langs.add("Ruby");
  if (existsSync(resolve(rootDir, "Package.swift"))) langs.add("Swift");
  if (existsSync(resolve(rootDir, "mix.exs"))) langs.add("Elixir");

  // If we have tsconfig, JS is implied but TS is primary
  if (langs.has("TypeScript") && langs.has("JavaScript")) {
    langs.delete("JavaScript");
  }

  return [...langs];
}

function scanPackageJson(rootDir: string): Partial<ProjectInfo> {
  const pkg = readJson(resolve(rootDir, "package.json"));
  if (!pkg) return {};

  const info: Partial<ProjectInfo> = {};
  info.name = pkg.name ?? basename(rootDir);

  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  // Scripts
  if (pkg.scripts) {
    info.buildCommand = pkg.scripts.build ? `${detectPackageManager(rootDir) ?? "npm"} run build` : null;
    info.testCommand = pkg.scripts.test ? `${detectPackageManager(rootDir) ?? "npm"} run test` : null;
    info.lintCommand = pkg.scripts.lint ? `${detectPackageManager(rootDir) ?? "npm"} run lint` : null;
    info.devCommand = pkg.scripts.dev ? `${detectPackageManager(rootDir) ?? "npm"} run dev` : null;
  }

  // Frameworks
  const frameworks: string[] = [];
  if (allDeps["next"]) frameworks.push("Next.js");
  else if (allDeps["nuxt"]) frameworks.push("Nuxt");
  else if (allDeps["@sveltejs/kit"]) frameworks.push("SvelteKit");
  else if (allDeps["@angular/core"]) frameworks.push("Angular");
  else if (allDeps["vue"]) frameworks.push("Vue");
  else if (allDeps["react"]) frameworks.push("React");
  if (allDeps["express"]) frameworks.push("Express");
  if (allDeps["fastify"]) frameworks.push("Fastify");
  if (allDeps["hono"]) frameworks.push("Hono");
  if (allDeps["tailwindcss"]) frameworks.push("Tailwind CSS");
  if (allDeps["prisma"] || allDeps["@prisma/client"]) {
    frameworks.push("Prisma");
    info.hasPrisma = true;
  }
  if (allDeps["drizzle-orm"]) frameworks.push("Drizzle ORM");
  info.frameworks = frameworks;

  // Test framework
  if (allDeps["vitest"]) info.testFramework = "Vitest";
  else if (allDeps["jest"]) info.testFramework = "Jest";
  else if (allDeps["mocha"]) info.testFramework = "Mocha";
  else if (allDeps["@playwright/test"]) info.testFramework = "Playwright";

  // Linter / Formatter
  if (allDeps["eslint"]) info.linter = "ESLint";
  if (allDeps["biome"] || allDeps["@biomejs/biome"]) {
    info.linter = "Biome";
    info.formatter = "Biome";
  }
  if (allDeps["prettier"]) info.formatter = "Prettier";

  return info;
}

function scanPyproject(rootDir: string): Partial<ProjectInfo> {
  const path = resolve(rootDir, "pyproject.toml");
  if (!existsSync(path)) return {};

  const content = readFileSync(path, "utf-8");
  const info: Partial<ProjectInfo> = {};

  // Project name
  const nameMatch = content.match(/^name\s*=\s*"([^"]+)"/m);
  if (nameMatch) info.name = nameMatch[1];

  // Detect tools
  if (content.includes("[tool.pytest")) info.testFramework = "pytest";
  if (content.includes("[tool.ruff")) {
    info.linter = "Ruff";
    info.formatter = "Ruff";
  }
  if (content.includes("[tool.black")) info.formatter = "Black";
  if (content.includes("[tool.mypy")) info.conventions = ["Type-checked with mypy"];
  if (content.includes("[tool.poetry")) info.packageManager = "Poetry";
  if (content.includes("[tool.pdm")) info.packageManager = "PDM";

  // Frameworks
  const frameworks: string[] = [];
  if (content.includes("django")) frameworks.push("Django");
  if (content.includes("fastapi")) frameworks.push("FastAPI");
  if (content.includes("flask")) frameworks.push("Flask");
  if (content.includes("streamlit")) frameworks.push("Streamlit");
  info.frameworks = frameworks;

  return info;
}

function scanGoMod(rootDir: string): Partial<ProjectInfo> {
  const path = resolve(rootDir, "go.mod");
  if (!existsSync(path)) return {};

  const content = readFileSync(path, "utf-8");
  const info: Partial<ProjectInfo> = {};

  const moduleMatch = content.match(/^module\s+(\S+)/m);
  if (moduleMatch) info.name = moduleMatch[1];

  info.buildCommand = "go build ./...";
  info.testCommand = "go test ./...";
  info.lintCommand = "golangci-lint run";

  const frameworks: string[] = [];
  if (content.includes("gin-gonic")) frameworks.push("Gin");
  if (content.includes("go-chi")) frameworks.push("Chi");
  if (content.includes("fiber")) frameworks.push("Fiber");
  if (content.includes("echo")) frameworks.push("Echo");
  info.frameworks = frameworks;

  return info;
}

function scanCargoToml(rootDir: string): Partial<ProjectInfo> {
  const path = resolve(rootDir, "Cargo.toml");
  if (!existsSync(path)) return {};

  const content = readFileSync(path, "utf-8");
  const info: Partial<ProjectInfo> = {};

  const nameMatch = content.match(/^name\s*=\s*"([^"]+)"/m);
  if (nameMatch) info.name = nameMatch[1];

  info.buildCommand = "cargo build";
  info.testCommand = "cargo test";
  info.lintCommand = "cargo clippy";

  const frameworks: string[] = [];
  if (content.includes("actix")) frameworks.push("Actix");
  if (content.includes("axum")) frameworks.push("Axum");
  if (content.includes("tokio")) frameworks.push("Tokio");
  info.frameworks = frameworks;

  return info;
}

function scanCodingConventions(rootDir: string): {
  indentation: { style: string; size: number } | null;
  quoteStyle: string | null;
  semicolons: boolean | null;
} {
  // Check .editorconfig
  const editorConfig = resolve(rootDir, ".editorconfig");
  let indentation: { style: string; size: number } | null = null;

  if (existsSync(editorConfig)) {
    const content = readFileSync(editorConfig, "utf-8");
    const styleMatch = content.match(/indent_style\s*=\s*(space|tab)/i);
    const sizeMatch = content.match(/indent_size\s*=\s*(\d+)/i);
    if (styleMatch) {
      indentation = {
        style: styleMatch[1] === "tab" ? "tabs" : "spaces",
        size: sizeMatch ? parseInt(sizeMatch[1]) : 2,
      };
    }
  }

  // Check Prettier config
  let quoteStyle: string | null = null;
  let semicolons: boolean | null = null;

  for (const name of [".prettierrc", ".prettierrc.json"]) {
    const prettierPath = resolve(rootDir, name);
    if (existsSync(prettierPath)) {
      const config = readJson(prettierPath);
      if (config) {
        if (config.singleQuote !== undefined)
          quoteStyle = config.singleQuote ? "single quotes" : "double quotes";
        if (config.semi !== undefined)
          semicolons = config.semi;
        if (!indentation && config.tabWidth)
          indentation = { style: config.useTabs ? "tabs" : "spaces", size: config.tabWidth };
      }
      break;
    }
  }

  // Check tsconfig for strictness
  const tsconfig = readJson(resolve(rootDir, "tsconfig.json"));
  if (tsconfig?.compilerOptions?.strict) {
    // strict mode detected — captured elsewhere
  }

  return { indentation, quoteStyle, semicolons };
}

function scanDirectories(rootDir: string): DirEntry[] {
  const entries: DirEntry[] = [];
  const skipDirs = new Set([
    "node_modules", "dist", "build", ".git", ".next", ".nuxt", ".svelte-kit",
    "__pycache__", ".venv", "venv", "env", ".env", "target", "coverage",
    ".cache", ".turbo", ".vercel", ".output",
  ]);

  try {
    const items = readdirSync(rootDir, { withFileTypes: true });
    for (const item of items) {
      if (!item.isDirectory()) continue;
      if (item.name.startsWith(".") && item.name !== ".github") continue;
      if (skipDirs.has(item.name)) continue;

      const description = guessDirectoryPurpose(item.name, rootDir);
      if (description) {
        entries.push({ name: item.name, description });
      }
    }
  } catch {
    // Permission denied
  }

  return entries;
}

function guessDirectoryPurpose(name: string, rootDir: string): string {
  const map: Record<string, string> = {
    src: "Source code",
    lib: "Library code",
    app: "Application entry points",
    pages: "Page routes",
    components: "UI components",
    hooks: "Custom hooks",
    utils: "Utility functions",
    helpers: "Helper functions",
    types: "Type definitions",
    models: "Data models",
    schemas: "Schemas and validation",
    services: "Service layer",
    controllers: "Request handlers",
    routes: "Route definitions",
    middleware: "Middleware",
    api: "API endpoints",
    server: "Server-side code",
    client: "Client-side code",
    public: "Static assets",
    static: "Static files",
    assets: "Asset files",
    styles: "Stylesheets",
    tests: "Test files",
    test: "Test files",
    __tests__: "Test files",
    spec: "Test specs",
    e2e: "End-to-end tests",
    fixtures: "Test fixtures",
    scripts: "Build/utility scripts",
    bin: "CLI entry points",
    cmd: "Command definitions",
    internal: "Internal packages",
    pkg: "Public packages",
    docs: "Documentation",
    config: "Configuration files",
    prisma: "Database schema and migrations",
    migrations: "Database migrations",
    db: "Database layer",
    ".github": "CI/CD workflows",
    screening: "Screening pipeline",
    tools: "Developer tools",
    packages: "Monorepo packages",
    apps: "Monorepo applications",
  };

  return map[name] ?? "";
}

function scanCI(rootDir: string): { provider: string; file: string } | null {
  if (existsSync(resolve(rootDir, ".github/workflows"))) {
    try {
      const workflows = readdirSync(resolve(rootDir, ".github/workflows"));
      const yml = workflows.find((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
      if (yml) return { provider: "GitHub Actions", file: `.github/workflows/${yml}` };
    } catch { /* */ }
    return { provider: "GitHub Actions", file: ".github/workflows/" };
  }
  if (existsSync(resolve(rootDir, ".gitlab-ci.yml")))
    return { provider: "GitLab CI", file: ".gitlab-ci.yml" };
  if (existsSync(resolve(rootDir, "Jenkinsfile")))
    return { provider: "Jenkins", file: "Jenkinsfile" };
  if (existsSync(resolve(rootDir, ".circleci/config.yml")))
    return { provider: "CircleCI", file: ".circleci/config.yml" };
  if (existsSync(resolve(rootDir, "bitbucket-pipelines.yml")))
    return { provider: "Bitbucket Pipelines", file: "bitbucket-pipelines.yml" };
  return null;
}

function scanDeployTarget(rootDir: string): string | null {
  if (existsSync(resolve(rootDir, "vercel.json")) || existsSync(resolve(rootDir, ".vercel")))
    return "Vercel";
  if (existsSync(resolve(rootDir, "netlify.toml")))
    return "Netlify";
  if (existsSync(resolve(rootDir, "fly.toml")))
    return "Fly.io";
  if (existsSync(resolve(rootDir, "render.yaml")))
    return "Render";
  if (existsSync(resolve(rootDir, "railway.toml")) || existsSync(resolve(rootDir, "railway.json")))
    return "Railway";
  if (existsSync(resolve(rootDir, "Procfile")))
    return "Heroku";
  if (existsSync(resolve(rootDir, "app.yaml")))
    return "Google App Engine";
  if (existsSync(resolve(rootDir, "serverless.yml")))
    return "Serverless Framework";
  return null;
}

function scanEnvFiles(rootDir: string): string[] {
  const envFiles: string[] = [];
  for (const name of [".env", ".env.local", ".env.example", ".env.development", ".env.production"]) {
    if (existsSync(resolve(rootDir, name))) envFiles.push(name);
  }
  return envFiles;
}

function scanDatabase(rootDir: string): string | null {
  if (existsSync(resolve(rootDir, "prisma/schema.prisma"))) {
    try {
      const schema = readFileSync(resolve(rootDir, "prisma/schema.prisma"), "utf-8");
      if (schema.includes("postgresql")) return "PostgreSQL (via Prisma)";
      if (schema.includes("mysql")) return "MySQL (via Prisma)";
      if (schema.includes("sqlite")) return "SQLite (via Prisma)";
      return "Database (via Prisma)";
    } catch {
      return "Database (via Prisma)";
    }
  }
  // Check for common DB config patterns in package.json
  const pkg = readJson(resolve(rootDir, "package.json"));
  if (pkg) {
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (allDeps["pg"] || allDeps["postgres"]) return "PostgreSQL";
    if (allDeps["mysql2"] || allDeps["mysql"]) return "MySQL";
    if (allDeps["better-sqlite3"] || allDeps["sqlite3"]) return "SQLite";
    if (allDeps["mongoose"] || allDeps["mongodb"]) return "MongoDB";
    if (allDeps["redis"] || allDeps["ioredis"]) return "Redis";
  }
  return null;
}

// ── Main scan + generate ──────────────────────────────────────────────

function scanProject(rootDir: string): ProjectInfo {
  const absRoot = resolve(rootDir);
  const pm = detectPackageManager(absRoot);
  const langs = detectLanguages(absRoot);
  const dirs = scanDirectories(absRoot);
  const ci = scanCI(absRoot);
  const deploy = scanDeployTarget(absRoot);
  const conventions = scanCodingConventions(absRoot);
  const envFiles = scanEnvFiles(absRoot);
  const database = scanDatabase(absRoot);

  // Merge language-specific scans
  let langInfo: Partial<ProjectInfo> = {};
  if (existsSync(resolve(absRoot, "package.json"))) {
    langInfo = { ...langInfo, ...scanPackageJson(absRoot) };
  }
  if (existsSync(resolve(absRoot, "pyproject.toml"))) {
    langInfo = { ...langInfo, ...scanPyproject(absRoot) };
  }
  if (existsSync(resolve(absRoot, "go.mod"))) {
    langInfo = { ...langInfo, ...scanGoMod(absRoot) };
  }
  if (existsSync(resolve(absRoot, "Cargo.toml"))) {
    langInfo = { ...langInfo, ...scanCargoToml(absRoot) };
  }

  return {
    name: langInfo.name ?? basename(absRoot),
    language: langs,
    packageManager: langInfo.packageManager ?? pm,
    frameworks: langInfo.frameworks ?? [],
    buildCommand: langInfo.buildCommand ?? null,
    testCommand: langInfo.testCommand ?? null,
    testFramework: langInfo.testFramework ?? null,
    lintCommand: langInfo.lintCommand ?? null,
    devCommand: langInfo.devCommand ?? null,
    formatter: langInfo.formatter ?? null,
    linter: langInfo.linter ?? null,
    directories: dirs,
    ciProvider: ci?.provider ?? null,
    ciFile: ci?.file ?? null,
    deployTarget: deploy,
    indentation: conventions.indentation,
    quoteStyle: conventions.quoteStyle,
    semicolons: conventions.semicolons,
    hasDocker: existsSync(resolve(absRoot, "Dockerfile")) || existsSync(resolve(absRoot, "docker-compose.yml")),
    hasPrisma: langInfo.hasPrisma ?? false,
    database,
    envFiles,
    conventions: langInfo.conventions ?? [],
  };
}

function buildMarkdown(info: ProjectInfo): { content: string; detections: Detection[] } {
  const lines: string[] = [];
  const detections: Detection[] = [];

  const today = new Date().toISOString().slice(0, 10);

  // ── 1. Project Overview (1-3 lines — orient Claude immediately) ──
  lines.push(`# ${info.name}`);
  lines.push("");

  const stackParts: string[] = [];
  if (info.language.length > 0) stackParts.push(...info.language);
  if (info.frameworks.length > 0) stackParts.push(...info.frameworks);
  if (stackParts.length > 0) {
    lines.push(`${stackParts.join(", ")} project.`);
    lines.push("");
    detections.push({ category: "stack", detail: stackParts.join(", ") });
  }

  // ── 2. Key Commands (only commands Claude can't guess from configs) ──
  const hasCommands = info.buildCommand || info.testCommand || info.lintCommand || info.devCommand;
  if (hasCommands) {
    lines.push("## Key Commands");
    lines.push("");
    if (info.devCommand) lines.push(`- \`${info.devCommand}\` — Start development server`);
    if (info.buildCommand) lines.push(`- \`${info.buildCommand}\` — Production build`);
    if (info.testCommand) lines.push(`- \`${info.testCommand}\` — Run test suite`);
    if (info.lintCommand) lines.push(`- \`${info.lintCommand}\` — Lint and format check`);
    lines.push("");
    detections.push({ category: "commands", detail: "Build/test/lint commands detected" });
  }

  // ── 3. Project Structure (brief directory map) ──
  if (info.directories.length > 0) {
    lines.push("## Project Structure");
    lines.push("");
    // Cap at 12 directories to keep output concise
    const dirs = info.directories.slice(0, 12);
    for (const dir of dirs) {
      lines.push(`- \`${dir.name}/\` — ${dir.description}`);
    }
    if (info.directories.length > 12) {
      lines.push(`- *(${info.directories.length - 12} more directories)*`);
    }
    lines.push("");
    detections.push({ category: "structure", detail: `${info.directories.length} directories mapped` });
  }

  // ── 4. Code Style (only non-default patterns — don't duplicate linter config) ──
  // Per Claude best practice: "Never send an LLM to do a linter's job"
  const styleRules: string[] = [];

  if (info.packageManager) {
    styleRules.push(`Use \`${info.packageManager}\` for all installs. Do not mix package managers`);
    detections.push({ category: "package-manager", detail: info.packageManager });
  }
  // Only mention linter/formatter existence, not their rules
  if (info.linter && info.formatter && info.linter === info.formatter) {
    styleRules.push(`${info.linter} handles both linting and formatting — its config is authoritative for style`);
    detections.push({ category: "linter", detail: info.linter });
  } else {
    if (info.linter) {
      styleRules.push(`${info.linter} config is authoritative for lint rules`);
      detections.push({ category: "linter", detail: info.linter });
    }
    if (info.formatter) {
      styleRules.push(`${info.formatter} config is authoritative for formatting`);
      detections.push({ category: "formatter", detail: info.formatter });
    }
  }
  for (const conv of info.conventions) {
    styleRules.push(conv);
  }

  if (styleRules.length > 0) {
    lines.push("## Code Style");
    lines.push("");
    for (const rule of styleRules) {
      lines.push(`- ${rule}`);
    }
    lines.push("");
  }

  // ── 5. Testing ──
  if (info.testFramework) {
    lines.push("## Testing");
    lines.push("");
    lines.push(`- Test runner: ${info.testFramework}`);
    if (info.testCommand) {
      lines.push(`- Run single test file: \`${info.testCommand} -- path/to/file.test.*\``);
    }
    lines.push("- New modules require a corresponding test file");
    lines.push("");
    detections.push({ category: "testing", detail: info.testFramework });
  }

  // ── 6. Architecture Decisions (TODO markers for human review) ──
  lines.push("## Architecture");
  lines.push("");
  lines.push("<!-- TODO: Add 2-3 key architecture decisions specific to this project.");
  lines.push("   Examples:");
  lines.push("   - State management uses Zustand in src/stores/");
  lines.push("   - API handlers follow the repository pattern in src/repos/");
  lines.push("   - Auth uses JWT with refresh tokens stored in httpOnly cookies");
  lines.push("   Remove this comment block after filling in. -->");
  lines.push("");

  // ── 7. Error Handling (language-specific, concrete patterns) ──
  if (info.language.length > 0) {
    lines.push("## Error Handling");
    lines.push("");
    if (info.language.includes("TypeScript") || info.language.includes("JavaScript")) {
      lines.push("- Wrap async operations in try/catch");
      lines.push("- Log errors to stderr with context: `console.error({ error, context })`");
      if (info.frameworks.some((f) => ["Next.js", "Express", "Fastify", "Hono"].includes(f))) {
        lines.push("- API routes return `{ error: string }` with appropriate HTTP status");
      }
    } else if (info.language.includes("Python")) {
      lines.push("- Use specific exception types, not bare `except:`");
      lines.push("- Log errors with `logger.exception()` for automatic traceback");
    } else if (info.language.includes("Go")) {
      lines.push("- Always check returned errors — never discard with `_`");
      lines.push("- Wrap errors with context: `fmt.Errorf(\"doing X: %w\", err)`");
    } else if (info.language.includes("Rust")) {
      lines.push("- Use `Result<T, E>` for fallible operations, not `unwrap()` in production");
      lines.push("- Propagate errors with `?`; use `thiserror` for custom error types");
    }
    lines.push("");
  }

  // ── 8. File Naming ──
  if (info.language.length > 0) {
    lines.push("## Naming Conventions");
    lines.push("");
    if (info.language.includes("TypeScript") || info.language.includes("JavaScript")) {
      if (info.frameworks.some((f) => ["React", "Next.js", "Vue", "Angular"].includes(f))) {
        lines.push("- Components: PascalCase (`UserProfile.tsx`)");
        lines.push("- Utilities: camelCase (`formatDate.ts`)");
      } else {
        lines.push("- Source files: camelCase (`myModule.ts`)");
      }
      lines.push("- Tests: co-located as `*.test.ts`");
    } else if (info.language.includes("Python")) {
      lines.push("- Modules: snake_case (`my_module.py`)");
      lines.push("- Tests: `test_*.py`");
    } else if (info.language.includes("Go")) {
      lines.push("- Files: snake_case (`my_handler.go`)");
      lines.push("- Tests: `*_test.go`");
    } else if (info.language.includes("Rust")) {
      lines.push("- Files: snake_case (`my_module.rs`)");
    }
    lines.push("");
  }

  // ── 9. Common Gotchas (TODO for human) ──
  lines.push("## Common Gotchas");
  lines.push("");
  lines.push("<!-- TODO: Add non-obvious behaviors or things that frequently trip people up.");
  lines.push("   Examples:");
  lines.push("   - The dev server requires REDIS_URL to be set or it silently falls back to in-memory");
  lines.push("   - Running migrations requires VPN access to the staging database");
  lines.push("   Remove this comment block after filling in. -->");
  lines.push("");

  // ── 10. Database ──
  if (info.database) {
    lines.push("## Database");
    lines.push("");
    lines.push(`- ${info.database}`);
    if (info.hasPrisma) {
      lines.push("- Schema: `prisma/schema.prisma`");
      lines.push("- Migrations: `npx prisma migrate dev`");
    }
    lines.push("");
    detections.push({ category: "database", detail: info.database });
  }

  // ── 11. Deployment ──
  if (info.deployTarget || info.hasDocker || info.ciProvider) {
    lines.push("## Deployment");
    lines.push("");
    if (info.ciProvider) {
      lines.push(`- CI: ${info.ciProvider} (\`${info.ciFile}\`)`);
      detections.push({ category: "ci", detail: info.ciProvider });
    }
    if (info.deployTarget) {
      lines.push(`- Deploy target: ${info.deployTarget}`);
      detections.push({ category: "deploy", detail: info.deployTarget });
    }
    if (info.hasDocker) {
      lines.push("- Docker available for containerized builds");
      detections.push({ category: "docker", detail: "Dockerfile found" });
    }
    if (info.envFiles.length > 0) {
      lines.push(`- Env files: ${info.envFiles.join(", ")} — never commit secrets`);
    }
    lines.push("");
  }

  // ── Timestamp ──
  lines.push(`Last updated: ${today}`);
  lines.push("");

  return { content: lines.join("\n"), detections };
}

// ── Public API ────────────────────────────────────────────────────────

export function generate(rootDir: string): GeneratorResult {
  const info = scanProject(rootDir);
  const { content, detections } = buildMarkdown(info);

  const parts: string[] = [];
  if (info.language.length > 0) parts.push(info.language.join(", "));
  if (info.frameworks.length > 0) parts.push(info.frameworks.join(", "));
  if (info.packageManager) parts.push(info.packageManager);
  if (info.testFramework) parts.push(info.testFramework);
  if (info.ciProvider) parts.push(info.ciProvider);

  const summary = parts.length > 0
    ? `Detected: ${parts.join(", ")}. Generated ${content.split("\n").length} lines.`
    : `Generated ${content.split("\n").length} lines (no project config files detected).`;

  return { content, detections, summary };
}
