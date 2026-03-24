/**
 * Generator module — scans a project and generates a CLAUDE.md from what it finds.
 *
 * Detects: package manager, languages, frameworks, build/test/lint commands,
 * directory structure, coding conventions, CI/CD, deployment, environment variables,
 * API endpoints, architecture patterns, path aliases, database schemas, and test infra.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, basename, join, relative } from "node:path";

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
  description: string | null;
  language: string[];
  packageManager: string | null;
  frameworks: string[];
  allScripts: Record<string, string>;
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
  hasDrizzle: boolean;
  database: string | null;
  databaseSchema: SchemaTable[];
  envFiles: string[];
  envVars: EnvVar[];
  conventions: string[];
  architecture: string[];
  apiEndpoints: ApiEndpoint[];
  pathAliases: PathAlias[];
  testConfig: TestConfig | null;
  gotchas: string[];
  deployDetails: DeployDetail[];
}

interface DirEntry {
  name: string;
  description: string;
}

interface EnvVar {
  name: string;
  source: string;
  required: boolean;
}

interface ApiEndpoint {
  method: string;
  path: string;
  description: string;
}

interface PathAlias {
  alias: string;
  target: string;
}

interface SchemaTable {
  name: string;
  columns: string[];
}

interface TestConfig {
  framework: string;
  environment: string | null;
  setupFile: string | null;
  libraries: string[];
  runCommand: string | null;
}

interface DeployDetail {
  platform: string;
  detail: string;
}

// ── Architecture pattern library ─────────────────────────────────────

const ARCHITECTURE_PATTERNS: Record<string, string> = {
  // AI / ML
  "@google/genai": "Google Gemini AI for text/image generation",
  "openai": "OpenAI API for AI-powered features",
  "@anthropic-ai/sdk": "Anthropic Claude API integration",
  "langchain": "LangChain for LLM orchestration",
  "replicate": "Replicate API for ML model inference",

  // State management
  "@tanstack/react-query": "React Query for server state management",
  "zustand": "Zustand for client state management",
  "@reduxjs/toolkit": "Redux Toolkit for global state",
  "jotai": "Jotai for atomic state management",
  "recoil": "Recoil for shared state",
  "mobx": "MobX for reactive state management",
  "valtio": "Valtio for proxy-based state",
  "swr": "SWR for data fetching and caching",

  // Routing
  "wouter": "Wouter for lightweight client routing",
  "react-router-dom": "React Router for client-side routing",
  "@tanstack/react-router": "TanStack Router for type-safe routing",

  // Component libraries
  "@radix-ui/react-dialog": "Radix UI primitives for accessible components",
  "@mantine/core": "Mantine component library",
  "@chakra-ui/react": "Chakra UI component library",
  "@mui/material": "Material UI component library",
  "antd": "Ant Design component library",

  // Real-time / Communication
  "socket.io": "Socket.io for real-time WebSocket communication",
  "ws": "WebSocket server for real-time communication",
  "pusher": "Pusher for real-time event broadcasting",

  // File handling
  "multer": "Multer for multipart file upload handling",
  "formidable": "Formidable for file upload parsing",
  "sharp": "Sharp for server-side image processing",

  // Auth
  "passport": "Passport.js for authentication",
  "next-auth": "NextAuth.js for authentication",
  "@auth/core": "Auth.js for authentication",
  "jsonwebtoken": "JWT-based authentication",
  "bcrypt": "Password hashing with bcrypt",

  // Email / Notifications
  "nodemailer": "Nodemailer for email sending",
  "@sendgrid/mail": "SendGrid for transactional email",
  "resend": "Resend for email delivery",

  // Validation
  "zod": "Zod for runtime schema validation",
  "yup": "Yup for schema validation",
  "joi": "Joi for schema validation",

  // Animation
  "framer-motion": "Framer Motion for animations",
  "gsap": "GSAP for advanced animations",

  // Payments
  "stripe": "Stripe for payment processing",
  "@paypal/checkout-server-sdk": "PayPal payment integration",

  // Caching / Queues
  "bullmq": "BullMQ for job queues",
  "ioredis": "Redis client for caching/pub-sub",

  // GraphQL
  "@apollo/server": "Apollo Server for GraphQL API",
  "graphql-yoga": "GraphQL Yoga server",
  "urql": "URQL GraphQL client",
  "@apollo/client": "Apollo Client for GraphQL",

  // Monitoring
  "@sentry/node": "Sentry for error monitoring",
  "pino": "Pino for structured logging",
  "winston": "Winston for application logging",

  // ORM / Database
  "drizzle-orm": "Drizzle ORM for type-safe database access",
  "@prisma/client": "Prisma ORM for database access",
  "typeorm": "TypeORM for database access",
  "sequelize": "Sequelize ORM for database access",
  "knex": "Knex.js for SQL query building",
  "mongoose": "Mongoose ODM for MongoDB",
  "@neondatabase/serverless": "Neon serverless PostgreSQL driver",
  "better-sqlite3": "SQLite via better-sqlite3",

  // Session
  "express-session": "Express session management",
  "cookie-session": "Cookie-based session management",
};

// ── Scanners ──────────────────────────────────────────────────────────

function readJson(filePath: string): any | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function readText(filePath: string): string | null {
  try {
    return readFileSync(filePath, "utf-8");
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

// ── Improvement #1: Project name resolution chain ────────────────────

function resolveProjectName(rootDir: string, pkgName: string | null): string {
  // Priority 1: README.md H1 heading
  const readmeName = extractReadmeTitle(rootDir);
  if (readmeName) return readmeName;

  // Priority 2: directory name (humanized)
  const dirName = basename(rootDir);
  const humanized = dirName
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  // Priority 3: package.json name (only if it looks intentional, not a scaffold default)
  const scaffoldNames = new Set([
    "rest-express", "my-app", "my-project", "starter", "template",
    "boilerplate", "example", "app", "project", "vite-project",
    "react-app", "next-app", "create-react-app",
  ]);

  if (pkgName && !scaffoldNames.has(pkgName) && !pkgName.startsWith("@") && pkgName !== dirName) {
    // Package name looks intentional but is less human-readable than dir name
    // Prefer dir name for the title
  }

  return humanized;
}

function extractReadmeTitle(rootDir: string): string | null {
  for (const name of ["README.md", "readme.md", "Readme.md"]) {
    const readmePath = resolve(rootDir, name);
    const content = readText(readmePath);
    if (!content) continue;

    // Match first H1 heading
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      // Strip badges, links, emojis from title
      let title = h1Match[1]
        .replace(/\[!\[.*?\]\(.*?\)\]\(.*?\)/g, "")  // badge links
        .replace(/!\[.*?\]\(.*?\)/g, "")                // images
        .replace(/\[([^\]]+)\]\(.*?\)/g, "$1")          // markdown links → text
        .replace(/<[^>]+>/g, "")                         // HTML tags
        .trim();
      if (title.length > 2 && title.length < 80) return title;
    }
  }
  return null;
}

// ── Improvement #8: Read README for project description ──────────────

function extractReadmeDescription(rootDir: string): string | null {
  for (const name of ["README.md", "readme.md", "Readme.md"]) {
    const content = readText(resolve(rootDir, name));
    if (!content) continue;

    const lines = content.split("\n");
    let foundH1 = false;

    for (const line of lines) {
      if (/^#\s+/.test(line)) { foundH1 = true; continue; }
      if (!foundH1) continue;

      // Skip blank lines, badges, HTML right after H1
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("![") || trimmed.startsWith("[![") || trimmed.startsWith("<")) continue;
      if (trimmed.startsWith("##")) break; // Hit next section

      // Found the description paragraph
      if (trimmed.length > 20 && trimmed.length < 300) {
        // Strip markdown formatting
        return trimmed
          .replace(/\*\*([^*]+)\*\*/g, "$1")
          .replace(/\[([^\]]+)\]\(.*?\)/g, "$1")
          .replace(/`([^`]+)`/g, "$1");
      }
    }
  }
  return null;
}

// ── Improvement #2: Extract ALL scripts from package.json ────────────

function categorizeScript(name: string): string | null {
  // Group scripts by purpose
  if (/^(dev|start:dev|serve)$/.test(name)) return "dev";
  if (/^(build|compile|bundle)$/.test(name)) return "build";
  if (/^(start|serve:prod)$/.test(name)) return "production";
  if (/^(test|test:.+|spec|vitest|jest)$/.test(name)) return "test";
  if (/^(lint|format|check|typecheck|tsc)$/.test(name)) return "quality";
  if (/^(db:.+|migrate|seed|prisma|drizzle)$/.test(name)) return "database";
  if (/^(deploy|release|publish)$/.test(name)) return "deploy";
  if (/^(clean|prebuild|postbuild|pretest|posttest|prepare|prepublishOnly)$/.test(name)) return null; // lifecycle, skip
  return "other";
}

function scanPackageJson(rootDir: string): Partial<ProjectInfo> {
  const pkg = readJson(resolve(rootDir, "package.json"));
  if (!pkg) return {};

  const info: Partial<ProjectInfo> = {};
  info.name = pkg.name ?? basename(rootDir);

  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  const pm = detectPackageManager(rootDir) ?? "npm";

  // Scripts — extract ALL, not just dev/build/test/lint
  const allScripts: Record<string, string> = {};
  if (pkg.scripts) {
    info.buildCommand = pkg.scripts.build ? `${pm} run build` : null;
    info.testCommand = pkg.scripts.test ? `${pm} run test` : null;
    info.lintCommand = pkg.scripts.lint ? `${pm} run lint` : null;
    info.devCommand = pkg.scripts.dev ? `${pm} run dev` : null;

    for (const [scriptName, scriptCmd] of Object.entries(pkg.scripts)) {
      const category = categorizeScript(scriptName);
      if (category) {
        allScripts[scriptName] = scriptCmd as string;
      }
    }
  }
  info.allScripts = allScripts;

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
  if (allDeps["tailwindcss"] || allDeps["@tailwindcss/vite"]) frameworks.push("Tailwind CSS");
  if (allDeps["prisma"] || allDeps["@prisma/client"]) {
    frameworks.push("Prisma");
    info.hasPrisma = true;
  }
  if (allDeps["drizzle-orm"]) {
    frameworks.push("Drizzle ORM");
    info.hasDrizzle = true;
  }
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

  // ── Improvement #3: Architecture from dependency analysis ──────────
  const architecture: string[] = [];
  for (const [dep, desc] of Object.entries(ARCHITECTURE_PATTERNS)) {
    if (allDeps[dep]) {
      architecture.push(desc);
    }
  }

  // Detect shadcn/ui via components.json
  if (existsSync(resolve(rootDir, "components.json"))) {
    architecture.push("shadcn/ui component library (Radix UI primitives)");
  }

  info.architecture = architecture;

  return info;
}

// ── Improvement #4: Environment variable extraction ──────────────────

function scanEnvVars(rootDir: string): EnvVar[] {
  const vars = new Map<string, EnvVar>();

  // Layer 1: Parse .env.example
  for (const envFile of [".env.example", ".env.development", ".env.local.example"]) {
    const content = readText(resolve(rootDir, envFile));
    if (!content) continue;
    for (const line of content.split("\n")) {
      const match = line.match(/^([A-Z][A-Z0-9_]+)\s*=/);
      if (match && !match[1].startsWith("#")) {
        const name = match[1];
        // Has a value in .env.example = probably has a default = not required
        const hasDefault = line.includes("=") && line.split("=")[1]?.trim().length > 0;
        vars.set(name, { name, source: envFile, required: !hasDefault });
      }
    }
  }

  // Layer 2: Grep source for process.env / import.meta.env usage
  const sourcePatterns = [
    /process\.env\.([A-Z][A-Z0-9_]+)/g,
    /import\.meta\.env\.([A-Z][A-Z0-9_]+)/g,
    /env\(\s*["']([A-Z][A-Z0-9_]+)["']\s*\)/g,
  ];

  const sourceFiles = findSourceFiles(rootDir, 3);
  for (const filePath of sourceFiles) {
    const content = readText(filePath);
    if (!content) continue;
    for (const pattern of sourcePatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const name = match[1];
        // Skip common non-env patterns
        if (name === "NODE_ENV" || name === "HOME" || name === "PATH" || name === "PWD") continue;
        if (!vars.has(name)) {
          const relPath = relative(rootDir, filePath);
          vars.set(name, { name, source: relPath, required: true });
        }
      }
    }
  }

  // Layer 3: Check framework configs for env references
  const drizzleConfig = readText(resolve(rootDir, "drizzle.config.ts")) ?? readText(resolve(rootDir, "drizzle.config.js"));
  if (drizzleConfig) {
    for (const pattern of sourcePatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(drizzleConfig)) !== null) {
        const name = match[1];
        if (!vars.has(name)) {
          vars.set(name, { name, source: "drizzle.config.ts", required: false });
        }
      }
    }
  }

  return [...vars.values()];
}

function findSourceFiles(rootDir: string, maxDepth: number): string[] {
  const files: string[] = [];
  const skipDirs = new Set([
    "node_modules", "dist", "build", ".git", ".next", ".nuxt",
    "__pycache__", ".venv", "venv", "target", "coverage", ".cache",
  ]);
  const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs"]);

  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;
    try {
      const items = readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        if (item.name.startsWith(".")) continue;
        const fullPath = resolve(dir, item.name);
        if (item.isDirectory()) {
          if (!skipDirs.has(item.name)) walk(fullPath, depth + 1);
        } else if (item.isFile()) {
          const ext = item.name.slice(item.name.lastIndexOf("."));
          if (extensions.has(ext) && !item.name.includes(".test.") && !item.name.includes(".spec.")) {
            files.push(fullPath);
          }
        }
      }
    } catch { /* permission denied */ }
  }

  walk(rootDir, 0);
  return files;
}

// ── Improvement #5: API endpoint extraction ──────────────────────────

function scanApiEndpoints(rootDir: string): ApiEndpoint[] {
  const endpoints: ApiEndpoint[] = [];
  const routeFiles = findRouteFiles(rootDir);

  for (const filePath of routeFiles) {
    const content = readText(filePath);
    if (!content) continue;

    // Express / Fastify / Hono patterns
    const patterns = [
      /(?:app|router|server)\.(get|post|put|patch|delete)\s*\(\s*["'`](\/[^"'`]*)["'`]/gi,
      /(?:app|router|server)\.(all)\s*\(\s*["'`](\/[^"'`]*)["'`]/gi,
    ];

    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const method = match[1].toUpperCase();
        const path = match[2];
        // Skip static file serving and wildcard catch-alls
        if (path === "/" && method === "GET") continue;
        if (path === "*" || path === "/*") continue;

        // Try to extract a description from nearby comments or variable names
        const desc = guessEndpointDescription(content, match.index, path);
        endpoints.push({ method, path, description: desc });
      }
    }
  }

  // Deduplicate by method+path
  const seen = new Set<string>();
  return endpoints.filter((ep) => {
    const key = `${ep.method} ${ep.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findRouteFiles(rootDir: string): string[] {
  const candidates: string[] = [];
  const routeNames = ["routes", "router", "api", "endpoints", "handlers", "controllers"];

  function walk(dir: string, depth: number) {
    if (depth > 3) return;
    try {
      const items = readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        if (item.name.startsWith(".") || item.name === "node_modules" || item.name === "dist") continue;
        const fullPath = resolve(dir, item.name);
        if (item.isDirectory()) {
          walk(fullPath, depth + 1);
        } else if (item.isFile()) {
          const lower = item.name.toLowerCase();
          if (routeNames.some((r) => lower.includes(r)) && /\.(ts|js|tsx|jsx)$/.test(lower)) {
            candidates.push(fullPath);
          }
          // Also check server entry points
          if (/^(server|app|index)\.(ts|js)$/.test(lower) && depth <= 1) {
            candidates.push(fullPath);
          }
        }
      }
    } catch { /* */ }
  }

  walk(rootDir, 0);
  return candidates;
}

function guessEndpointDescription(content: string, matchIndex: number, path: string): string {
  // Look at the 3 lines before the match for a comment
  const before = content.slice(Math.max(0, matchIndex - 200), matchIndex);
  const lines = before.split("\n");
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 3); i--) {
    const line = lines[i].trim();
    if (line.startsWith("//") || line.startsWith("*")) {
      const comment = line.replace(/^\/\/\s*/, "").replace(/^\*\s*/, "").trim();
      if (comment.length > 5 && comment.length < 100) return comment;
    }
  }

  // Fallback: derive from path
  const parts = path.split("/").filter(Boolean);
  if (parts.length >= 2) {
    const resource = parts[parts.length - 1].replace(/:[^/]+/g, "").replace(/-/g, " ");
    if (resource && resource !== "api") return resource;
  }
  return "";
}

// ── Improvement #6: Deeper project structure (2 levels) ──────────────

function scanDirectories(rootDir: string): DirEntry[] {
  const entries: DirEntry[] = [];
  const skipDirs = new Set([
    "node_modules", "dist", "build", ".git", ".next", ".nuxt", ".svelte-kit",
    "__pycache__", ".venv", "venv", "env", ".env", "target", "coverage",
    ".cache", ".turbo", ".vercel", ".output", "attached_assets",
  ]);

  // Directories that should be expanded one level deeper
  const expandDirs = new Set(["src", "client", "server", "app", "lib", "packages", "apps"]);

  try {
    const items = readdirSync(rootDir, { withFileTypes: true });
    for (const item of items) {
      if (!item.isDirectory()) continue;
      if (item.name.startsWith(".") && item.name !== ".github") continue;
      if (skipDirs.has(item.name)) continue;

      const description = guessDirectoryPurpose(item.name, rootDir);
      if (!description) continue;

      // Check if this directory should be expanded
      if (expandDirs.has(item.name)) {
        // Add the parent with its description
        entries.push({ name: item.name, description });

        // Scan one level deeper
        const subDir = resolve(rootDir, item.name);
        try {
          // Check for src/ inside client/ or server/
          const srcInside = resolve(subDir, "src");
          const scanTarget = existsSync(srcInside) && statSync(srcInside).isDirectory() ? srcInside : subDir;
          const prefix = scanTarget === srcInside ? `${item.name}/src` : item.name;

          const subItems = readdirSync(scanTarget, { withFileTypes: true });
          for (const sub of subItems) {
            if (!sub.isDirectory()) continue;
            if (sub.name.startsWith(".") || skipDirs.has(sub.name)) continue;
            const subDesc = guessDirectoryPurpose(sub.name, scanTarget);
            if (subDesc) {
              entries.push({ name: `${prefix}/${sub.name}`, description: subDesc });
            }
          }
        } catch { /* */ }
      } else {
        entries.push({ name: item.name, description });
      }
    }
  } catch {
    // Permission denied
  }

  return entries;
}

function guessDirectoryPurpose(name: string, _rootDir: string): string {
  const map: Record<string, string> = {
    src: "Source code",
    lib: "Library code",
    app: "Application entry points",
    pages: "Page routes",
    components: "UI components",
    hooks: "Custom React hooks",
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
    test: "Test configuration",
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
    shared: "Shared types and schemas",
    common: "Shared utilities",
    ui: "UI component primitives",
    features: "Feature modules",
    stores: "State stores",
    actions: "Server actions",
    contexts: "React contexts",
    providers: "Context providers",
    layouts: "Layout components",
    views: "View components",
  };

  return map[name] ?? "";
}

// ── Improvement #7: Auto-populate gotchas ────────────────────────────

function detectGotchas(rootDir: string, info: Partial<ProjectInfo>): string[] {
  const gotchas: string[] = [];

  // In-memory storage pattern
  const sourceFiles = findSourceFiles(rootDir, 2);
  let hasMemStorage = false;
  let hasSSE = false;
  let hasSpeechApi = false;
  let hasNoRateLimit = true;

  for (const filePath of sourceFiles) {
    const content = readText(filePath);
    if (!content) continue;

    if (/MemStorage|new Map\(\)|memoryStorage\(\)|InMemory/i.test(content)) hasMemStorage = true;
    if (/text\/event-stream|EventSource|Server-Sent Events?|SSE/i.test(content)) hasSSE = true;
    if (/speechSynthesis|SpeechRecognition|webkitSpeechRecognition/i.test(content)) hasSpeechApi = true;
    if (/rateLimit|rate-limit|express-rate-limit|throttle/i.test(content)) hasNoRateLimit = false;
  }

  if (hasMemStorage) {
    gotchas.push("Data is stored in memory — all state is lost on server restart. Not suitable for production without a persistent database");
  }

  // .env.example exists but .env is gitignored
  if (existsSync(resolve(rootDir, ".env.example"))) {
    gotchas.push("Copy `.env.example` to `.env` and fill in API keys before running");
  }

  // Drizzle configured but may default to in-memory
  if (info.hasDrizzle && hasMemStorage) {
    gotchas.push("Database is configured via Drizzle ORM but the app defaults to in-memory storage without `DATABASE_URL`");
  }

  // No rate limiting on API
  if (hasNoRateLimit && (info.frameworks ?? []).some(f => ["Express", "Fastify", "Hono"].includes(f))) {
    gotchas.push("No rate limiting on API endpoints — add middleware before production deployment");
  }

  // Speech API requires HTTPS
  if (hasSpeechApi) {
    gotchas.push("Web Speech API (text-to-speech / speech recognition) requires HTTPS in production");
  }

  // SSE connection limits
  if (hasSSE) {
    gotchas.push("Server-Sent Events connections are limited by browser (6 per domain) — consider HTTP/2 for production");
  }

  return gotchas;
}

// ── Improvement #9: Path aliases from tsconfig ───────────────────────

function scanPathAliases(rootDir: string): PathAlias[] {
  const tsconfig = readJson(resolve(rootDir, "tsconfig.json"));
  if (!tsconfig?.compilerOptions?.paths) return [];

  const aliases: PathAlias[] = [];
  const paths = tsconfig.compilerOptions.paths as Record<string, string[]>;
  const baseUrl = tsconfig.compilerOptions.baseUrl ?? ".";

  for (const [alias, targets] of Object.entries(paths)) {
    if (targets.length > 0) {
      const target = join(baseUrl, targets[0]).replace(/\/\*$/, "/");
      const cleanAlias = alias.replace(/\/\*$/, "/");
      aliases.push({ alias: cleanAlias, target });
    }
  }

  return aliases;
}

// ── Improvement #10: Deployment details ──────────────────────────────

function scanDeployDetails(rootDir: string): DeployDetail[] {
  const details: DeployDetail[] = [];

  // Replit
  const replitConfig = readText(resolve(rootDir, ".replit"));
  if (replitConfig) {
    const portMatch = replitConfig.match(/(?:localPort|port)\s*=\s*(\d+)/);
    const port = portMatch ? portMatch[1] : null;
    details.push({ platform: "Replit", detail: port ? `Port ${port}` : "Configured" });
  }

  // Vercel
  if (existsSync(resolve(rootDir, "vercel.json")) || existsSync(resolve(rootDir, ".vercel"))) {
    details.push({ platform: "Vercel", detail: "Configured" });
  }

  // Fly.io
  const flyConfig = readText(resolve(rootDir, "fly.toml"));
  if (flyConfig) {
    const appMatch = flyConfig.match(/app\s*=\s*"([^"]+)"/);
    details.push({ platform: "Fly.io", detail: appMatch ? `App: ${appMatch[1]}` : "Configured" });
  }

  // Docker
  if (existsSync(resolve(rootDir, "Dockerfile"))) {
    details.push({ platform: "Docker", detail: "Dockerfile present" });
  }
  if (existsSync(resolve(rootDir, "docker-compose.yml")) || existsSync(resolve(rootDir, "docker-compose.yaml"))) {
    details.push({ platform: "Docker Compose", detail: "docker-compose.yml present" });
  }

  // Railway, Render, Heroku, etc.
  if (existsSync(resolve(rootDir, "railway.toml")) || existsSync(resolve(rootDir, "railway.json")))
    details.push({ platform: "Railway", detail: "Configured" });
  if (existsSync(resolve(rootDir, "render.yaml")))
    details.push({ platform: "Render", detail: "render.yaml present" });
  if (existsSync(resolve(rootDir, "Procfile")))
    details.push({ platform: "Heroku", detail: "Procfile present" });
  if (existsSync(resolve(rootDir, "netlify.toml")))
    details.push({ platform: "Netlify", detail: "Configured" });

  // Note DEPLOYMENT.md reference
  if (existsSync(resolve(rootDir, "DEPLOYMENT.md")))
    details.push({ platform: "Docs", detail: "See `DEPLOYMENT.md` for full deployment guide" });

  return details;
}

// ── Improvement #11: Database schema summary ─────────────────────────

function scanDatabaseSchema(rootDir: string): SchemaTable[] {
  const tables: SchemaTable[] = [];

  // Drizzle ORM: scan for pgTable / mysqlTable / sqliteTable calls
  const drizzleConfig = readText(resolve(rootDir, "drizzle.config.ts")) ?? readText(resolve(rootDir, "drizzle.config.js"));
  if (drizzleConfig) {
    // Extract schema file path from config
    const schemaMatch = drizzleConfig.match(/schema:\s*["']([^"']+)["']/);
    if (schemaMatch) {
      const schemaPath = resolve(rootDir, schemaMatch[1]);
      const schemaContent = readText(schemaPath);
      if (schemaContent) {
        parseDrizzleSchema(schemaContent, tables);
      }
    }
  }

  // Also check common schema locations
  if (tables.length === 0) {
    for (const candidate of ["shared/schema.ts", "src/db/schema.ts", "src/schema.ts", "db/schema.ts", "server/db/schema.ts"]) {
      const content = readText(resolve(rootDir, candidate));
      if (content) {
        parseDrizzleSchema(content, tables);
        if (tables.length > 0) break;
      }
    }
  }

  // Prisma schema
  if (tables.length === 0 && existsSync(resolve(rootDir, "prisma/schema.prisma"))) {
    const content = readText(resolve(rootDir, "prisma/schema.prisma"));
    if (content) {
      parsePrismaSchema(content, tables);
    }
  }

  return tables;
}

function parseDrizzleSchema(content: string, tables: SchemaTable[]): void {
  // Match pgTable("tableName", { ... }) or mysqlTable or sqliteTable
  const tableRegex = /(?:pgTable|mysqlTable|sqliteTable)\s*\(\s*["'](\w+)["']\s*,\s*\{([^}]+)\}/g;
  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    const name = match[1];
    const body = match[2];
    // Extract column names
    const cols: string[] = [];
    const colRegex = /(\w+)\s*:/g;
    let colMatch;
    while ((colMatch = colRegex.exec(body)) !== null) {
      cols.push(colMatch[1]);
    }
    tables.push({ name, columns: cols });
  }
}

function parsePrismaSchema(content: string, tables: SchemaTable[]): void {
  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
  let match;
  while ((match = modelRegex.exec(content)) !== null) {
    const name = match[1];
    const body = match[2];
    const cols: string[] = [];
    for (const line of body.split("\n")) {
      const colMatch = line.trim().match(/^(\w+)\s+\w+/);
      if (colMatch && !colMatch[1].startsWith("@@") && !colMatch[1].startsWith("//")) {
        cols.push(colMatch[1]);
      }
    }
    tables.push({ name, columns: cols });
  }
}

// ── Improvement #12: Test infrastructure details ─────────────────────

function scanTestConfig(rootDir: string, testFramework: string | null): TestConfig | null {
  if (!testFramework) return null;

  const config: TestConfig = {
    framework: testFramework,
    environment: null,
    setupFile: null,
    libraries: [],
    runCommand: null,
  };

  const pkg = readJson(resolve(rootDir, "package.json"));
  const allDeps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };

  // Detect test libraries
  if (allDeps["@testing-library/react"]) config.libraries.push("@testing-library/react");
  if (allDeps["@testing-library/jest-dom"]) config.libraries.push("@testing-library/jest-dom");
  if (allDeps["@testing-library/user-event"]) config.libraries.push("@testing-library/user-event");
  if (allDeps["supertest"]) config.libraries.push("supertest");
  if (allDeps["nock"]) config.libraries.push("nock");
  if (allDeps["msw"]) config.libraries.push("msw");

  // Vitest config
  if (testFramework === "Vitest") {
    const vitestConfig = readText(resolve(rootDir, "vitest.config.ts")) ?? readText(resolve(rootDir, "vitest.config.js"));
    if (vitestConfig) {
      const envMatch = vitestConfig.match(/environment:\s*["'](\w+)["']/);
      if (envMatch) config.environment = envMatch[1];

      const setupMatch = vitestConfig.match(/setupFiles:\s*\[?\s*["']([^"']+)["']/);
      if (setupMatch) config.setupFile = setupMatch[1];
    }
    config.runCommand = "npx vitest run";
  }

  // Jest config
  if (testFramework === "Jest") {
    const jestConfig = readJson(resolve(rootDir, "jest.config.json")) ?? readJson(resolve(rootDir, "jest.config.js"));
    if (jestConfig) {
      if (jestConfig.testEnvironment) config.environment = jestConfig.testEnvironment;
      if (jestConfig.setupFilesAfterSetup?.[0]) config.setupFile = jestConfig.setupFilesAfterSetup[0];
    }
    config.runCommand = "npx jest";
  }

  return config;
}

function scanPyproject(rootDir: string): Partial<ProjectInfo> {
  const pyPath = resolve(rootDir, "pyproject.toml");
  if (!existsSync(pyPath)) return {};

  const content = readFileSync(pyPath, "utf-8");
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
  const goPath = resolve(rootDir, "go.mod");
  if (!existsSync(goPath)) return {};

  const content = readFileSync(goPath, "utf-8");
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
  const cargoPath = resolve(rootDir, "Cargo.toml");
  if (!existsSync(cargoPath)) return {};

  const content = readFileSync(cargoPath, "utf-8");
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

  return { indentation, quoteStyle, semicolons };
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
  if (existsSync(resolve(rootDir, ".replit")))
    return "Replit";
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
  // Check Drizzle config for dialect
  const drizzleConfig = readText(resolve(rootDir, "drizzle.config.ts")) ?? readText(resolve(rootDir, "drizzle.config.js"));
  if (drizzleConfig) {
    if (drizzleConfig.includes("postgresql") || drizzleConfig.includes("pg")) return "PostgreSQL (via Drizzle ORM)";
    if (drizzleConfig.includes("mysql")) return "MySQL (via Drizzle ORM)";
    if (drizzleConfig.includes("sqlite")) return "SQLite (via Drizzle ORM)";
    return "Database (via Drizzle ORM)";
  }

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
    if (allDeps["drizzle-orm"]) {
      if (allDeps["pg"] || allDeps["@neondatabase/serverless"]) return "PostgreSQL (via Drizzle ORM)";
      if (allDeps["mysql2"]) return "MySQL (via Drizzle ORM)";
      if (allDeps["better-sqlite3"]) return "SQLite (via Drizzle ORM)";
      return "Database (via Drizzle ORM)";
    }
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

  // Improvement #1: resolve name properly
  const rawName = langInfo.name ?? basename(absRoot);
  const name = resolveProjectName(absRoot, rawName);

  // Improvement #8: extract description from README
  const description = extractReadmeDescription(absRoot);

  // Improvement #4: env vars
  const envVars = scanEnvVars(absRoot);

  // Improvement #5: API endpoints
  const apiEndpoints = scanApiEndpoints(absRoot);

  // Improvement #7: gotchas
  const partialInfo: Partial<ProjectInfo> = {
    ...langInfo,
    frameworks: langInfo.frameworks ?? [],
    hasDrizzle: langInfo.hasDrizzle ?? false,
  };
  const gotchas = detectGotchas(absRoot, partialInfo);

  // Improvement #9: path aliases
  const pathAliases = scanPathAliases(absRoot);

  // Improvement #10: deploy details
  const deployDetails = scanDeployDetails(absRoot);

  // Improvement #11: database schema
  const databaseSchema = scanDatabaseSchema(absRoot);

  // Improvement #12: test config
  const testConfig = scanTestConfig(absRoot, langInfo.testFramework ?? null);

  return {
    name,
    description,
    language: langs,
    packageManager: langInfo.packageManager ?? pm,
    frameworks: langInfo.frameworks ?? [],
    allScripts: langInfo.allScripts ?? {},
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
    hasDrizzle: langInfo.hasDrizzle ?? false,
    database,
    databaseSchema,
    envFiles,
    envVars,
    conventions: langInfo.conventions ?? [],
    architecture: langInfo.architecture ?? [],
    apiEndpoints,
    pathAliases,
    testConfig,
    gotchas,
    deployDetails,
  };
}

function buildMarkdown(info: ProjectInfo): { content: string; detections: Detection[] } {
  const lines: string[] = [];
  const detections: Detection[] = [];

  const today = new Date().toISOString().slice(0, 10);

  // ── 1. Project Overview (name + description + stack) ──
  lines.push(`# ${info.name}`);
  lines.push("");

  // Description from README
  if (info.description) {
    lines.push(info.description);
    lines.push("");
  }

  const stackParts: string[] = [];
  if (info.language.length > 0) stackParts.push(...info.language);
  if (info.frameworks.length > 0) stackParts.push(...info.frameworks);
  if (stackParts.length > 0) {
    lines.push(`${stackParts.join(", ")} project.`);
    lines.push("");
    detections.push({ category: "stack", detail: stackParts.join(", ") });
  }

  // ── 2. Build / Dev Commands (ALL scripts, grouped by purpose) ──
  const pm = info.packageManager ?? "npm";
  const scriptGroups: Record<string, Array<{ name: string; cmd: string }>> = {
    dev: [],
    build: [],
    production: [],
    test: [],
    quality: [],
    database: [],
    deploy: [],
    other: [],
  };

  for (const [name, cmd] of Object.entries(info.allScripts)) {
    const cat = categorizeScript(name);
    if (cat && scriptGroups[cat]) {
      scriptGroups[cat].push({ name, cmd: `${pm} run ${name}` });
    }
  }

  const hasAnyScript = Object.values(scriptGroups).some(g => g.length > 0);
  if (hasAnyScript) {
    lines.push("## Build and Dev Commands");
    lines.push("");

    const groupLabels: Record<string, string> = {
      dev: "Development",
      build: "Build",
      production: "Production",
      test: "Testing",
      quality: "Quality",
      database: "Database",
      deploy: "Deploy",
      other: "Other",
    };

    // Flatten into a single list for conciseness, but include all scripts
    for (const [group, scripts] of Object.entries(scriptGroups)) {
      for (const script of scripts) {
        const description = guessScriptDescription(script.name, info.allScripts[script.name]);
        lines.push(`- \`${script.cmd}\` — ${description}`);
      }
    }
    lines.push("");
    detections.push({ category: "commands", detail: `${Object.values(scriptGroups).flat().length} scripts detected` });
  }

  // ── 3. Project Structure (deep, 2-level) ──
  if (info.directories.length > 0) {
    lines.push("## Project Structure");
    lines.push("");
    const dirs = info.directories.slice(0, 18);
    for (const dir of dirs) {
      lines.push(`- \`${dir.name}/\` — ${dir.description}`);
    }
    if (info.directories.length > 18) {
      lines.push(`- *(${info.directories.length - 18} more directories)*`);
    }
    lines.push("");
    detections.push({ category: "structure", detail: `${info.directories.length} directories mapped` });
  }

  // ── 4. Architecture (auto-filled from deps, not a TODO) ──
  if (info.architecture.length > 0) {
    lines.push("## Architecture");
    lines.push("");
    for (const item of info.architecture) {
      lines.push(`- ${item}`);
    }
    lines.push("");
    detections.push({ category: "architecture", detail: `${info.architecture.length} patterns detected` });
  }

  // ── 5. API Endpoints ──
  if (info.apiEndpoints.length > 0) {
    lines.push("## API Endpoints");
    lines.push("");
    for (const ep of info.apiEndpoints) {
      const desc = ep.description ? ` — ${ep.description}` : "";
      lines.push(`- \`${ep.method} ${ep.path}\`${desc}`);
    }
    lines.push("");
    detections.push({ category: "api", detail: `${info.apiEndpoints.length} endpoints detected` });
  }

  // ── 6. Environment Variables ──
  if (info.envVars.length > 0) {
    lines.push("## Environment Variables");
    lines.push("");
    lines.push("| Variable | Required | Source |");
    lines.push("|----------|----------|--------|");
    for (const v of info.envVars) {
      lines.push(`| \`${v.name}\` | ${v.required ? "Yes" : "No"} | ${v.source} |`);
    }
    lines.push("");
    if (info.envFiles.includes(".env.example")) {
      lines.push("Copy `.env.example` to `.env` and fill in values before running.");
      lines.push("");
    }
    detections.push({ category: "env-vars", detail: `${info.envVars.length} variables detected` });
  }

  // ── 7. Path Aliases ──
  if (info.pathAliases.length > 0) {
    lines.push("## Import Aliases");
    lines.push("");
    for (const alias of info.pathAliases) {
      lines.push(`- \`${alias.alias}\` → \`${alias.target}\``);
    }
    lines.push("");
    detections.push({ category: "aliases", detail: `${info.pathAliases.length} path aliases` });
  }

  // ── 8. Coding Conventions / Linting ──
  const styleRules: string[] = [];

  if (info.packageManager) {
    styleRules.push(`Use \`${info.packageManager}\` for all installs. Do not mix package managers`);
    detections.push({ category: "package-manager", detail: info.packageManager });
  }
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
    lines.push("## Coding Conventions and Linting");
    lines.push("");
    for (const rule of styleRules) {
      lines.push(`- ${rule}`);
    }
    lines.push("");
  }

  // ── 9. Testing (detailed) ──
  if (info.testConfig) {
    lines.push("## Testing");
    lines.push("");
    lines.push(`- Runner: ${info.testConfig.framework}${info.testConfig.environment ? ` (${info.testConfig.environment} environment)` : ""}`);
    if (info.testConfig.libraries.length > 0) {
      lines.push(`- Libraries: ${info.testConfig.libraries.map(l => `\`${l}\``).join(", ")}`);
    }
    if (info.testConfig.setupFile) {
      lines.push(`- Setup: \`${info.testConfig.setupFile}\``);
    }
    if (info.testConfig.runCommand) {
      lines.push(`- Run all: \`${info.testConfig.runCommand}\``);
      lines.push(`- Run one: \`${info.testConfig.runCommand} path/to/file.test.ts\``);
    }
    lines.push("- New modules require a corresponding test file");
    lines.push("");
    detections.push({ category: "testing", detail: info.testConfig.framework });
  } else if (info.testFramework) {
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

  // ── 10. Error Handling ──
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

  // ── 11. Naming Conventions ──
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

  // ── 12. Common Gotchas (auto-populated) ──
  if (info.gotchas.length > 0) {
    lines.push("## Common Gotchas");
    lines.push("");
    for (const gotcha of info.gotchas) {
      lines.push(`- ${gotcha}`);
    }
    lines.push("");
    detections.push({ category: "gotchas", detail: `${info.gotchas.length} gotchas detected` });
  }

  // ── 13. Database ──
  if (info.database) {
    lines.push("## Database");
    lines.push("");
    lines.push(`- ${info.database}`);
    if (info.hasPrisma) {
      lines.push("- Schema: `prisma/schema.prisma`");
      lines.push("- Migrations: `npx prisma migrate dev`");
    }
    if (info.hasDrizzle) {
      // Find the schema file
      const drizzleConfig = readText(resolve(resolve(rootDir ?? "."), "drizzle.config.ts"));
      const schemaMatch = drizzleConfig?.match(/schema:\s*["']([^"']+)["']/);
      if (schemaMatch) {
        lines.push(`- Schema: \`${schemaMatch[1]}\``);
      }
      lines.push("- Migrations: `npx drizzle-kit push`");
    }
    if (info.databaseSchema.length > 0) {
      lines.push(`- Tables: ${info.databaseSchema.map(t => `\`${t.name}\` (${t.columns.join(", ")})`).join(", ")}`);
    }
    lines.push("");
    detections.push({ category: "database", detail: info.database });
  }

  // ── 14. Deployment ──
  if (info.deployDetails.length > 0 || info.ciProvider) {
    lines.push("## Deployment");
    lines.push("");
    if (info.ciProvider) {
      lines.push(`- CI: ${info.ciProvider} (\`${info.ciFile}\`)`);
      detections.push({ category: "ci", detail: info.ciProvider });
    }
    for (const d of info.deployDetails) {
      lines.push(`- ${d.platform}: ${d.detail}`);
    }
    if (info.envFiles.length > 0 && info.envVars.length === 0) {
      lines.push(`- Env files: ${info.envFiles.join(", ")} — never commit secrets`);
    }
    lines.push("");
    detections.push({ category: "deploy", detail: `${info.deployDetails.length} platforms detected` });
  }

  // ── Timestamp ──
  lines.push(`Last updated: ${today}`);
  lines.push("");

  return { content: lines.join("\n"), detections };
}

function guessScriptDescription(name: string, cmd: string): string {
  const descriptions: Record<string, string> = {
    dev: "Start development server",
    build: "Production build",
    start: "Start production server",
    test: "Run test suite",
    lint: "Lint and format check",
    format: "Format code",
    check: "Type-check",
    typecheck: "Type-check",
    tsc: "Type-check with TypeScript compiler",
    "db:push": "Push database schema changes",
    "db:migrate": "Run database migrations",
    "db:seed": "Seed database",
    "db:studio": "Open database GUI",
    migrate: "Run database migrations",
    seed: "Seed database",
    deploy: "Deploy to production",
    preview: "Preview production build locally",
    clean: "Clean build artifacts",
    storybook: "Start Storybook",
  };

  if (descriptions[name]) return descriptions[name];

  // Infer from command content
  if (cmd.includes("vitest") || cmd.includes("jest")) return "Run test suite";
  if (cmd.includes("tsc")) return "Type-check";
  if (cmd.includes("eslint")) return "Lint code";
  if (cmd.includes("prettier")) return "Format code";
  if (cmd.includes("drizzle-kit")) return "Database operations";
  if (cmd.includes("prisma")) return "Database operations";

  return name.replace(/[-:_]/g, " ");
}

// ── Public API ────────────────────────────────────────────────────────

// Keep rootDir accessible for buildMarkdown's database section
let rootDir = ".";

export function generate(dir: string): GeneratorResult {
  rootDir = dir;
  const info = scanProject(dir);
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
