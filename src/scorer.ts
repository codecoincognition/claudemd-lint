/**
 * Weighted scoring engine — aggregates dimension scores into overall report
 */

import { parseFile } from "./parser.js";
import {
  checkConsistency,
  checkStaleness,
  checkRedundancy,
  checkScopeSpecificity,
  checkTokenEfficiency,
  checkActionability,
  checkMaintainability,
} from "./rules/index.js";
import type {
  LintReport,
  DimensionScore,
  LintConfig,
  FileStats,
  DEFAULT_CONFIG,
} from "./types.js";

export function lint(filePath: string, config: LintConfig): LintReport {
  const file = parseFile(filePath, config.rootDir);

  // Run all dimension checks
  const dimensions: DimensionScore[] = [
    checkConsistency(file),
    checkStaleness(file, config.rootDir),
    checkRedundancy(file),
    checkScopeSpecificity(file, config.rootDir),
    checkTokenEfficiency(file),
    checkActionability(file),
    checkMaintainability(file),
  ];

  // Calculate weighted overall score
  const totalWeight = Object.values(config.weights).reduce((a, b) => a + b, 0);
  let weightedSum = 0;

  for (const dim of dimensions) {
    const weight = config.weights[dim.dimension] ?? 1;
    weightedSum += dim.score * weight;
  }

  const overallScore = Math.round((weightedSum / totalWeight) * 10) / 10;

  // Determine verdict
  let verdict: LintReport["verdict"];
  if (overallScore >= 8) verdict = "excellent";
  else if (overallScore >= 6) verdict = "good";
  else if (overallScore >= 4) verdict = "needs-work";
  else verdict = "poor";

  // Aggregate all findings
  const findings = dimensions.flatMap((d) => d.findings);

  // Compile stats
  const stats: FileStats = {
    lineCount: file.lineCount,
    wordCount: file.wordCount,
    sectionCount: file.sections.length,
    ruleCount: file.rules.length,
    importCount: file.imports.length,
    staleRefCount: file.fileRefs.filter((r) => !r.exists).length,
    estimatedTokens: Math.round(file.wordCount * 0.75),
  };

  return {
    filePath: file.path,
    overallScore,
    verdict,
    dimensions,
    findings,
    stats,
    timestamp: new Date().toISOString(),
  };
}
