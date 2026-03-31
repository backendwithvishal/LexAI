/**
 * Security Analyzer
 *
 * Scans source files for common security anti-patterns:
 *   - Hardcoded secrets / credentials
 *   - Dangerous function calls (eval, exec, etc.)
 *   - Insecure random number generation
 *   - SQL/NoSQL injection patterns
 *   - Sensitive data in logs
 */

const RULES = [
    {
        id: 'hardcoded-secret',
        severity: 'critical',
        pattern: /(password|secret|api_?key|token|auth)\s*[:=]\s*['"][^'"]{6,}['"]/i,
        message: 'Possible hardcoded secret or credential detected.',
    },
    {
        id: 'eval-usage',
        severity: 'high',
        pattern: /\beval\s*\(/,
        message: 'Use of eval() is dangerous — it executes arbitrary code.',
    },
    {
        id: 'insecure-random',
        severity: 'medium',
        pattern: /Math\.random\s*\(\s*\)/,
        message: 'Math.random() is not cryptographically secure. Use crypto.randomBytes() instead.',
    },
    {
        id: 'console-log-sensitive',
        severity: 'low',
        pattern: /console\.(log|info|debug)\s*\(.*?(password|token|secret|key)/i,
        message: 'Possible sensitive data being logged to console.',
    },
    {
        id: 'nosql-injection',
        severity: 'high',
        pattern: /\$where\s*:|new\s+Function\s*\(/,
        message: 'Potential NoSQL injection vector detected.',
    },
    {
        id: 'process-env-direct',
        severity: 'low',
        pattern: /process\.env\.[A-Z_]+(?!\s*\|\|)/,
        message: 'Direct process.env access without fallback — use validated env config instead.',
    },
];

/**
 * Analyze a single file's content for security issues.
 *
 * @param {string} filePath - Path to the file (for reporting)
 * @param {string} content  - File content as string
 * @returns {Array<object>} Array of findings
 */
export function analyzeFile(filePath, content) {
    const findings = [];
    const lines = content.split('\n');

    for (const rule of RULES) {
        lines.forEach((line, index) => {
            // Skip comment lines
            if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

            if (rule.pattern.test(line)) {
                findings.push({
                    ruleId: rule.id,
                    severity: rule.severity,
                    message: rule.message,
                    file: filePath,
                    line: index + 1,
                    snippet: line.trim().substring(0, 120),
                });
            }
        });
    }

    return findings;
}

/**
 * Summarize findings by severity.
 *
 * @param {Array<object>} findings
 * @returns {object} Summary counts
 */
export function summarizeFindings(findings) {
    return findings.reduce((acc, f) => {
        acc[f.severity] = (acc[f.severity] || 0) + 1;
        return acc;
    }, { critical: 0, high: 0, medium: 0, low: 0 });
}
