import { generateMarkdownReport } from '../../../src/reporters/MarkdownReporter.js';

const mockResult = {
    targetPath: '/app/src',
    summary: { critical: 1, high: 0, medium: 1, low: 0, info: 0 },
    findings: [
        { ruleId: 'eval-usage', severity: 'critical', message: 'eval detected', file: 'src/test.js', line: 5, snippet: "eval('x')" },
        { ruleId: 'deep-nesting', severity: 'medium', message: 'Too deep', file: 'src/other.js', line: 20, snippet: null },
    ],
};

describe('generateMarkdownReport', () => {
    it('includes title and target path', () => {
        const md = generateMarkdownReport(mockResult);
        expect(md).toContain('# Codebase Audit Report');
        expect(md).toContain('/app/src');
    });

    it('includes summary table', () => {
        const md = generateMarkdownReport(mockResult);
        expect(md).toContain('## Summary');
        expect(md).toContain('critical');
    });

    it('includes findings grouped by file', () => {
        const md = generateMarkdownReport(mockResult);
        expect(md).toContain('src/test.js');
        expect(md).toContain('eval-usage');
    });

    it('shows no issues message when findings are empty', () => {
        const md = generateMarkdownReport({ ...mockResult, findings: [], summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 } });
        expect(md).toContain('No issues found');
    });
});
