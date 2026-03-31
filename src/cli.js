#!/usr/bin/env node
/**
 * LexAI Codebase Auditor CLI
 *
 * Usage:
 *   npx codebase-auditor [path] [options]
 *   node src/cli.js [path] [options]
 *
 * Options:
 *   --format  Output format: json | markdown (default: markdown)
 *   --output  Write report to file instead of stdout
 *   --help    Show this help message
 */

import { readdir, stat, writeFile } from 'fs/promises';
import { resolve, extname, relative } from 'path';

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(`
LexAI Codebase Auditor

Usage:
  codebase-auditor [path] [options]

Options:
  --format <json|markdown>   Output format (default: markdown)
  --output <file>            Write report to file
  --help                     Show this help

Examples:
  codebase-auditor ./src
  codebase-auditor ./src --format json
  codebase-auditor ./src --output report.md
\n`);
    process.exit(0);
}

// Parse args
const targetPath = args.find((a) => !a.startsWith('--')) || '.';
const formatIdx = args.indexOf('--format');
const format = formatIdx !== -1 ? args[formatIdx + 1] : 'markdown';
const outputIdx = args.indexOf('--output');
const outputFile = outputIdx !== -1 ? args[outputIdx + 1] : null;

async function scanDirectory(dir, results = { files: [], stats: {} }) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = resolve(dir, entry.name);

        // Skip common non-source directories
        if (['node_modules', '.git', 'coverage', 'dist', '.kiro'].includes(entry.name)) continue;

        if (entry.isDirectory()) {
            await scanDirectory(fullPath, results);
        } else {
            const ext = extname(entry.name);
            const fileStat = await stat(fullPath);
            results.files.push({
                path: relative(targetPath, fullPath),
                ext,
                size: fileStat.size,
            });
            results.stats[ext] = (results.stats[ext] || 0) + 1;
        }
    }

    return results;
}

async function run() {
    const absPath = resolve(targetPath);

    process.stderr.write(`Scanning: ${absPath}\n`);

    let scanResult;
    try {
        scanResult = await scanDirectory(absPath);
    } catch (err) {
        process.stderr.write(`Error scanning path: ${err.message}\n`);
        process.exit(1);
    }

    const totalFiles = scanResult.files.length;
    const totalSize = scanResult.files.reduce((sum, f) => sum + f.size, 0);
    const jsFiles = (scanResult.stats['.js'] || 0) + (scanResult.stats['.mjs'] || 0);
    const testFiles = scanResult.files.filter((f) => f.path.includes('.test.') || f.path.includes('.spec.')).length;

    const report = {
        generatedAt: new Date().toISOString(),
        targetPath: absPath,
        summary: {
            totalFiles,
            totalSizeBytes: totalSize,
            jsFiles,
            testFiles,
            testCoverage: jsFiles > 0 ? `${Math.round((testFiles / jsFiles) * 100)}%` : '0%',
            filesByExtension: scanResult.stats,
        },
        files: scanResult.files,
    };

    let output;
    if (format === 'json') {
        output = JSON.stringify(report, null, 2);
    } else {
        output = [
            `# Codebase Audit Report`,
            `**Generated:** ${report.generatedAt}`,
            `**Path:** ${report.targetPath}`,
            ``,
            `## Summary`,
            `| Metric | Value |`,
            `|--------|-------|`,
            `| Total Files | ${totalFiles} |`,
            `| JS/MJS Files | ${jsFiles} |`,
            `| Test Files | ${testFiles} |`,
            `| Estimated Test Coverage | ${report.summary.testCoverage} |`,
            `| Total Size | ${(totalSize / 1024).toFixed(1)} KB |`,
            ``,
            `## Files by Extension`,
            ...Object.entries(scanResult.stats).map(([ext, count]) => `- \`${ext}\`: ${count} files`),
        ].join('\n');
    }

    if (outputFile) {
        await writeFile(outputFile, output, 'utf8');
        process.stderr.write(`Report written to: ${outputFile}\n`);
    } else {
        process.stdout.write(`${output  }\n`);
    }
}

run().catch((err) => {
    process.stderr.write(`Fatal error: ${err.message}\n`);
    process.exit(1);
});
