/**
 * JSON Reporter
 *
 * Serializes audit findings to structured JSON.
 * Suitable for CI pipelines, dashboards, and programmatic consumption.
 */

/**
 * Generate a JSON report from audit findings.
 *
 * @param {object} auditResult
 * @param {Array}  auditResult.findings  - All findings from all analyzers
 * @param {object} auditResult.summary   - Summary counts by severity
 * @param {string} auditResult.targetPath
 * @returns {string} Pretty-printed JSON string
 */
export function generateJsonReport(auditResult) {
    const report = {
        generatedAt: new Date().toISOString(),
        targetPath: auditResult.targetPath,
        summary: auditResult.summary,
        totalFindings: auditResult.findings.length,
        findings: auditResult.findings,
    };

    return JSON.stringify(report, null, 2);
}
