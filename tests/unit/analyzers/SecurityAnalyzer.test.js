import { analyzeFile, summarizeFindings } from '../../../src/analyzers/SecurityAnalyzer.js';

describe('SecurityAnalyzer.analyzeFile', () => {
    it('detects hardcoded secrets', () => {
        const content = `const apiKey = 'super-secret-key-123';`;
        const findings = analyzeFile('test.js', content);
        expect(findings.some((f) => f.ruleId === 'hardcoded-secret')).toBe(true);
    });

    it('detects eval usage', () => {
        const content = `eval('console.log(1)')`;
        const findings = analyzeFile('test.js', content);
        expect(findings.some((f) => f.ruleId === 'eval-usage')).toBe(true);
    });

    it('detects Math.random usage', () => {
        const content = `const id = Math.random() * 1000;`;
        const findings = analyzeFile('test.js', content);
        expect(findings.some((f) => f.ruleId === 'insecure-random')).toBe(true);
    });

    it('skips comment lines', () => {
        const content = `// const password = 'test123'`;
        const findings = analyzeFile('test.js', content);
        expect(findings).toHaveLength(0);
    });

    it('returns empty array for clean code', () => {
        const content = `export function add(a, b) { return a + b; }`;
        const findings = analyzeFile('test.js', content);
        expect(findings).toHaveLength(0);
    });

    it('includes file path and line number in findings', () => {
        const content = `eval('x')`;
        const findings = analyzeFile('src/test.js', content);
        expect(findings[0].file).toBe('src/test.js');
        expect(findings[0].line).toBe(1);
    });
});

describe('summarizeFindings', () => {
    it('counts findings by severity', () => {
        const findings = [
            { severity: 'critical' },
            { severity: 'high' },
            { severity: 'high' },
            { severity: 'low' },
        ];
        const summary = summarizeFindings(findings);
        expect(summary.critical).toBe(1);
        expect(summary.high).toBe(2);
        expect(summary.low).toBe(1);
        expect(summary.medium).toBe(0);
    });
});
