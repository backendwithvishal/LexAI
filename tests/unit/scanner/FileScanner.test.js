import FileScanner from '../../../src/scanner/FileScanner.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('FileScanner', () => {
  let scanner;
  let testDir;

  beforeEach(async () => {
    scanner = new FileScanner();
    // Create a temporary test directory
    testDir = path.join(os.tmpdir(), `file-scanner-test-${Date.now()}`);
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    if (testDir && await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }
  });

  describe('scanDirectory', () => {
    test('should discover all JavaScript and TypeScript files', async () => {
      // Create test files
      await fs.writeFile(path.join(testDir, 'file1.js'), 'console.log("test");');
      await fs.writeFile(path.join(testDir, 'file2.ts'), 'const x: number = 1;');
      await fs.writeFile(path.join(testDir, 'file3.txt'), 'text file');

      const result = await scanner.scanDirectory(testDir);

      expect(result.totalFiles).toBe(2);
      expect(result.files).toHaveLength(2);
      expect(result.files.some(f => f.relativePath === 'file1.js')).toBe(true);
      expect(result.files.some(f => f.relativePath === 'file2.ts')).toBe(true);
    });

    test('should recursively traverse subdirectories', async () => {
      // Create nested directory structure
      await fs.ensureDir(path.join(testDir, 'subdir1'));
      await fs.ensureDir(path.join(testDir, 'subdir1', 'subdir2'));
      
      await fs.writeFile(path.join(testDir, 'root.js'), '// root');
      await fs.writeFile(path.join(testDir, 'subdir1', 'sub1.js'), '// sub1');
      await fs.writeFile(path.join(testDir, 'subdir1', 'subdir2', 'sub2.js'), '// sub2');

      const result = await scanner.scanDirectory(testDir);

      expect(result.totalFiles).toBe(3);
      expect(result.files.some(f => f.relativePath === 'root.js')).toBe(true);
      expect(result.files.some(f => f.relativePath.includes('subdir1'))).toBe(true);
      expect(result.files.some(f => f.relativePath.includes('subdir2'))).toBe(true);
    });

    test('should exclude node_modules directory', async () => {
      await fs.ensureDir(path.join(testDir, 'node_modules'));
      await fs.writeFile(path.join(testDir, 'app.js'), '// app');
      await fs.writeFile(path.join(testDir, 'node_modules', 'lib.js'), '// lib');

      const result = await scanner.scanDirectory(testDir);

      expect(result.totalFiles).toBe(1);
      expect(result.files[0].relativePath).toBe('app.js');
    });

    test('should exclude .git directory', async () => {
      await fs.ensureDir(path.join(testDir, '.git'));
      await fs.writeFile(path.join(testDir, 'code.js'), '// code');
      await fs.writeFile(path.join(testDir, '.git', 'config'), 'git config');

      const result = await scanner.scanDirectory(testDir);

      expect(result.totalFiles).toBe(1);
      expect(result.files[0].relativePath).toBe('code.js');
    });

    test('should exclude test files by default', async () => {
      await fs.writeFile(path.join(testDir, 'app.js'), '// app');
      await fs.writeFile(path.join(testDir, 'app.test.js'), '// test');
      await fs.writeFile(path.join(testDir, 'app.spec.js'), '// spec');

      const result = await scanner.scanDirectory(testDir);

      expect(result.totalFiles).toBe(1);
      expect(result.files[0].relativePath).toBe('app.js');
    });

    test('should include file metadata (path, type, size, lastModified)', async () => {
      await fs.writeFile(path.join(testDir, 'myapp.js'), 'console.log("test");');

      const result = await scanner.scanDirectory(testDir);

      expect(result.totalFiles).toBeGreaterThan(0);
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files[0]).toHaveProperty('path');
      expect(result.files[0]).toHaveProperty('relativePath');
      expect(result.files[0]).toHaveProperty('type');
      expect(result.files[0]).toHaveProperty('size');
      expect(result.files[0]).toHaveProperty('lastModified');
      expect(result.files[0].size).toBeGreaterThan(0);
      // Check that lastModified is a valid date
      expect(result.files[0].lastModified).toBeTruthy();
      expect(typeof result.files[0].lastModified.getTime).toBe('function');
      expect(result.files[0].lastModified.getTime()).toBeGreaterThan(0);
    });

    test('should respect custom include patterns', async () => {
      await fs.writeFile(path.join(testDir, 'file.js'), '// js');
      await fs.writeFile(path.join(testDir, 'file.ts'), '// ts');
      await fs.writeFile(path.join(testDir, 'file.jsx'), '// jsx');

      const result = await scanner.scanDirectory(testDir, {
        includePatterns: ['**/*.js'],
        fileExtensions: ['.js']
      });

      expect(result.totalFiles).toBe(1);
      expect(result.files[0].relativePath).toBe('file.js');
    });

    test('should respect custom exclude patterns', async () => {
      await fs.ensureDir(path.join(testDir, 'src'));
      await fs.ensureDir(path.join(testDir, 'dist'));
      
      await fs.writeFile(path.join(testDir, 'src', 'app.js'), '// src');
      await fs.writeFile(path.join(testDir, 'dist', 'app.js'), '// dist');

      const result = await scanner.scanDirectory(testDir, {
        excludePatterns: ['dist/**']
      });

      expect(result.files.every(f => !f.relativePath.includes('dist'))).toBe(true);
    });

    test('should handle empty directories', async () => {
      const result = await scanner.scanDirectory(testDir);

      expect(result.totalFiles).toBe(0);
      expect(result.files).toHaveLength(0);
    });
  });

  describe('shouldIncludeFile', () => {
    test('should include .js files', () => {
      const result = scanner.shouldIncludeFile('/path/to/file.js', {
        fileExtensions: ['.js', '.ts']
      });

      expect(result).toBe(true);
    });

    test('should include .ts files', () => {
      const result = scanner.shouldIncludeFile('/path/to/file.ts', {
        fileExtensions: ['.js', '.ts']
      });

      expect(result).toBe(true);
    });

    test('should exclude files with non-matching extensions', () => {
      const result = scanner.shouldIncludeFile('/path/to/file.txt', {
        fileExtensions: ['.js', '.ts']
      });

      expect(result).toBe(false);
    });

    test('should exclude files matching exclude patterns', () => {
      const result = scanner.shouldIncludeFile('node_modules/package/file.js', {
        excludePatterns: ['node_modules/**'],
        fileExtensions: ['.js', '.ts']
      });

      expect(result).toBe(false);
    });

    test('should handle files with no extension', () => {
      const result = scanner.shouldIncludeFile('/path/to/file', {
        fileExtensions: ['.js', '.ts']
      });

      expect(result).toBe(false);
    });
  });

  describe('classifyFile', () => {
    test('should classify .js files as javascript', () => {
      expect(scanner.classifyFile('file.js')).toBe('javascript');
    });

    test('should classify .jsx files as javascript', () => {
      expect(scanner.classifyFile('component.jsx')).toBe('javascript');
    });

    test('should classify .mjs files as javascript', () => {
      expect(scanner.classifyFile('module.mjs')).toBe('javascript');
    });

    test('should classify .cjs files as javascript', () => {
      expect(scanner.classifyFile('common.cjs')).toBe('javascript');
    });

    test('should classify .ts files as typescript', () => {
      expect(scanner.classifyFile('file.ts')).toBe('typescript');
    });

    test('should classify .tsx files as typescript', () => {
      expect(scanner.classifyFile('component.tsx')).toBe('typescript');
    });

    test('should classify .json files as json', () => {
      expect(scanner.classifyFile('config.json')).toBe('json');
    });

    test('should classify unknown extensions as other', () => {
      expect(scanner.classifyFile('file.txt')).toBe('other');
    });

    test('should handle uppercase extensions', () => {
      expect(scanner.classifyFile('FILE.JS')).toBe('javascript');
    });

    test('should handle files with multiple dots', () => {
      expect(scanner.classifyFile('file.test.js')).toBe('javascript');
    });
  });
});
