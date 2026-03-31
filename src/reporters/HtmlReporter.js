/**
 * HTML Reporter
 *
 * Generates a styled HTML audit report.
 * Suitable for sharing with stakeholders and archiving.
 */

const SEVERITY_COLOR = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#3b82f6',
    info: '#6b7280',
};

/**
 * Generate an HTML report from audit findings.
 *
 * @param {object} auditResult
 * @returns {string} HTML string
 */
export function generateHtmlReport(auditResult) {
    const { findings, summary, targetPath } = auditResult;

    const summaryRows = Object.entries(summary)
        .filter(([, count]) => count > 0)
        .map(([sev, count]) => `
            <tr>
                <td><span style="color:${SEVERITY_COLOR[sev]};font-weight:600;">${sev}</span></td>
                <td>${count}</td>
            </tr>`).join('');

    const findingRows = findings.map((f) => `
        <tr>
            <td><code>${f.file}:${f.line}</code></td>
            <td><span style="color:${SEVERITY_COLOR[f.severity]};font-weight:600;">${f.severity}</span></td>
            <td><code>${f.ruleId}</code></td>
            <td>${f.message}</td>
        </tr>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Audit Report — LexAI</title>
  <style>
    body{font-family:-apple-system,sans-serif;margin:40px;color:#1a1a2e;}
    h1{color:#1a1a2e;}
    table{border-collapse:collapse;width:100%;margin:16px 0;}
    th,td{border:1px solid #e5e7eb;padding:8px 12px;text-align:left;font-size:13px;}
    th{background:#f9fafb;font-weight:600;}
    code{background:#f3f4f6;padding:2px 4px;border-radius:3px;font-size:12px;}
  </style>
</head>
<body>
  <h1>Codebase Audit Report</h1>
  <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
  <p><strong>Target:</strong> <code>${targetPath}</code></p>
  <h2>Summary</h2>
  <table><thead><tr><th>Severity</th><th>Count</th></tr></thead>
  <tbody>${summaryRows}</tbody></table>
  <h2>Findings (${findings.length})</h2>
  <table>
    <thead><tr><th>Location</th><th>Severity</th><th>Rule</th><th>Message</th></tr></thead>
    <tbody>${findingRows || '<tr><td colspan="4">No issues found ✅</td></tr>'}</tbody>
  </table>
</body>
</html>`;
}
