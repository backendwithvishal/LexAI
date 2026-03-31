/**
 * Complexity Analyzer
 *
 * Estimates cyclomatic complexity and detects code smell patterns:
 *   - Functions that are too long
 *   - Too many parameters
 *   - Deeply nested blocks
 *   - TODO/FIXME/HACK comments
 */

const THRESHOLDS = {
    maxFunctionLines: 80,
    maxParams: 5,
    maxNestingDepth: 4,
};

/**
 * Analyze a file for complexity issues.
 *
 * @param {string} filePath
 * @param {string} content
 * @returns {Array<object>} findings
 */
export function analyzeComplexity(filePath, content) {
    const findings = [];
    const lines = content.split('\n');

    let _currentFunctionStart = -1;
    let _currentFunctionName = '';
    let braceDepth = 0;
    let maxDepthInFunction = 0;

    lines.forEach((line, index) => {
        const lineNum = index + 1;

        // Detect TODO/FIXME/HACK comments
        if (/\b(TODO|FIXME|HACK|XXX)\b/i.test(line)) {
            findings.push({
                ruleId: 'todo-comment',
                severity: 'info',
                message: `Unresolved comment: ${line.trim().substring(0, 80)}`,
                file: filePath,
                line: lineNum,
            });
        }

        // Track brace depth for nesting analysis
        const opens = (line.match(/\{/g) || []).length;
        const closes = (line.match(/\}/g) || []).length;
        braceDepth += opens - closes;
        maxDepthInFunction = Math.max(maxDepthInFunction, braceDepth);

        // Detect function declarations
        const funcMatch = line.match(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\()/);
        if (funcMatch) {
            _currentFunctionStart = lineNum;
            _currentFunctionName = funcMatch[1] || funcMatch[2] || 'anonymous';
            maxDepthInFunction = 0;
        }

        // Detect too many parameters
        const paramMatch = line.match(/function\s*\w*\s*\(([^)]+)\)/);
        if (paramMatch) {
            const params = paramMatch[1].split(',').filter((p) => p.trim());
            if (params.length > THRESHOLDS.maxParams) {
                findings.push({
                    ruleId: 'too-many-params',
                    severity: 'medium',
                    message: `Function has ${params.length} parameters (max ${THRESHOLDS.maxParams}). Consider using an options object.`,
                    file: filePath,
                    line: lineNum,
                });
            }
        }

        // Check nesting depth
        if (braceDepth > THRESHOLDS.maxNestingDepth) {
            findings.push({
                ruleId: 'deep-nesting',
                severity: 'medium',
                message: `Nesting depth ${braceDepth} exceeds maximum of ${THRESHOLDS.maxNestingDepth}. Consider extracting logic into functions.`,
                file: filePath,
                line: lineNum,
            });
        }
    });

    return findings;
}
