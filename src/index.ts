export { lint } from "./scorer.js";
export { startMcpServer } from "./mcp.js";
export { parseFile, discoverFiles } from "./parser.js";
export { formatTerminal, formatJson, formatCi } from "./reporter.js";
export { fix } from "./fixer.js";
export type { FixResult, FixAction } from "./fixer.js";
export { generate } from "./generator.js";
export type { GeneratorResult, Detection } from "./generator.js";
export type {
  LintReport,
  LintConfig,
  DimensionScore,
  Finding,
  Dimension,
  ParsedFile,
  FileStats,
} from "./types.js";
export { DEFAULT_CONFIG } from "./types.js";
