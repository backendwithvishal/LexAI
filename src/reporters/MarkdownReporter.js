/**
 * Markdown Reporter
 *
 * Generates a human-readable Markdown audit report.
 * Suitable for GitHub PRs, wikis, and documentation.
 */

const SEVERITY_EMOJI = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🔵',
    info: 'ℹ️',
};

/**
 * Generate a Markdown report from audit findings.
 *
 * @param {object} auditResult
 * @returns {string} Markdown string
 */
export function generateMarkdownReport(auditResult) {
    const { findings, summary, targetPath } = auditResult;
    const lines = [];

    lines.push(`# Codebase Audit Report`);
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push(`**Target:** \`${targetPath}\``);
    lines.push('');

    // Summary table
    lines.push('## Summary');
    lines.push('| Severity | Count |');
    lines.push('|----------|-------|');
    for (const [severity, count] of Object.entries(summary)) {
        if (count > 0) {
            lines.push(`| ${SEVERITY_EMOJI[severity] || ''} ${severity} | ${count} |`);
        }
    }
    lines.push('');

    if (findings.length === 0) {
        lines.push('✅ No issues found.');
        return lines.join('\n');
    }

    // Group findings by file
    const byFile = findings.reduce((acc, f) => {
        if (!acc[f.file]) acc[f.file] = [];
        acc[f.file].push(f);
        return acc;
    }, {});

    lines.push('## Findings');
    for (const [file, fileFindings] of Object.entries(byFile)) {
        lines.push(`### \`${file}\``);
        for (const f of fileFindings) {
            const emoji = SEVERITY_EMOJI[f.severity] || '';
            lines.push(`- **Line ${f.line}** ${emoji} \`${f.ruleId}\` — ${f.message}`);
            if (f.snippet) {
                lines.push(`  \`\`\`\n  ${f.snippet}\n  \`\`\``);
            }
        }
        lines.push('');
    }

    return lines.join('\n');
}
