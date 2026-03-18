/**
 * Core types for claudemd-lint
 */

export interface ParsedFile {
  path: string;
  content: string;
  lines: string[];
  sections: Section[];
  rules: Rule[];
  imports: ImportRef[];
  fileRefs: FileRef[];
  wordCount: number;
  lineCount: number;
}

export interface Section {
  title: string;
  level: number;
  startLine: number;
  endLine: number;
  content: string;
  wordCount: number;
}

export interface Rule {
  text: string;
  line: number;
  section: string;
  type: "directive" | "guideline" | "example" | "reference";
}

export interface ImportRef {
  path: string;
  line: number;
  resolved: boolean;
}

export interface FileRef {
  path: string;
  line: number;
  exists: boolean;
}

export type Dimension =
  | "consistency"
  | "staleness"
  | "redundancy"
  | "scopeSpecificity"
  | "tokenEfficiency"
  | "actionability"
  | "maintainability";

export interface Finding {
  dimension: Dimension;
  severity: "error" | "warning" | "info";
  message: string;
  line?: number;
  endLine?: number;
  suggestion?: string;
  details?: string;
}

export interface DimensionScore {
  dimension: Dimension;
  score: number; // 1-10
  findings: Finding[];
  summary: string;
}

export interface LintReport {
  filePath: string;
  overallScore: number;
  verdict: "excellent" | "good" | "needs-work" | "poor";
  dimensions: DimensionScore[];
  findings: Finding[];
  stats: FileStats;
  timestamp: string;
}

export interface FileStats {
  lineCount: number;
  wordCount: number;
  sectionCount: number;
  ruleCount: number;
  importCount: number;
  staleRefCount: number;
  estimatedTokens: number;
}

export interface LintConfig {
  /** Max word count before warning (default: 10000) */
  maxWords: number;
  /** Max line count before warning (default: 500) */
  maxLines: number;
  /** Weights for each dimension (default: equal) */
  weights: Record<Dimension, number>;
  /** Root directory for file reference validation */
  rootDir: string;
  /** Whether to check monorepo hierarchy */
  checkHierarchy: boolean;
  /** Output format */
  format: "terminal" | "json" | "ci";
}

export const DEFAULT_CONFIG: LintConfig = {
  maxWords: 10000,
  maxLines: 500,
  weights: {
    consistency: 1,
    staleness: 1,
    redundancy: 1,
    scopeSpecificity: 1,
    tokenEfficiency: 1,
    actionability: 1,
    maintainability: 1,
  },
  rootDir: ".",
  checkHierarchy: true,
  format: "terminal",
};
