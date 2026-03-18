export { lint } from "./scorer.js";
export { parseFile, discoverFiles } from "./parser.js";
export { formatTerminal, formatJson, formatCi } from "./reporter.js";
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
