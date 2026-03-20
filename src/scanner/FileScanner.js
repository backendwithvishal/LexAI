const fastGlob = require('fast-glob');
const ignore = require('ignore');
const fs = require('fs-extra');
const path = require('path');

/**
 * FileScanner - Discovers and catalogs all files in the codebase
 * 
 * Responsibilities:
 * - Recursively traverse all subdirectories
 * - Identify all JavaScript and TypeScript files for analysis
 * - Exclude node_modules, .git, and other configured ignore patterns
 * - Generate a file inventory with paths and file types
 * - Report the total count of files discovered
 */
class FileScanner {
  constructor() {
    this.ignoreFilter = null;
  }

  /**
   * Recursively scan directory for files
   * @param {string} rootPath - Starting directory
   * @param {Object} options - Include/exclude patterns
   * @param {string[]} options.includePatterns - Glob patterns for files to include
   * @param {string[]} options.excludePatterns - Glob patterns for files to exclude
   * @param {string[]} options.fileExtensions - File extensions to include
   * @returns {Promise<Object>} FileInventory with totalFiles and files array
   */
  async scanDirectory(rootPath, options = {}) {
    const {
      includePatterns = ['**/*.js', '**/*.ts'],
      excludePatterns = [
        'node_modules/**',
        '.git/**',
        'dist/**',
        'build/**',
        'coverage/**',
        '*.test.js',
        '*.spec.js'
      ],
      fileExtensions = ['.js', '.ts']
    } = options;

    // Store rootPath for relative path calculations
    this.rootPath = rootPath;

    // Initialize ignore filter with exclude patterns
    this.ignoreFilter = ignore().add(excludePatterns);

    // Use fast-glob to find all matching files
    const globPatterns = includePatterns.map(pattern => 
      path.join(rootPath, pattern).replace(/\\/g, '/')
    );

    const files = await fastGlob(globPatterns, {
      ignore: excludePatterns,
      absolute: true,
      onlyFiles: true,
      dot: false
    });

    // Build file inventory with metadata
    const fileInventory = {
      totalFiles: 0,
      files: []
    };

    for (const filePath of files) {
      if (this.shouldIncludeFile(filePath, { excludePatterns, fileExtensions })) {
        const stats = await fs.stat(filePath);
        const relativePath = path.relative(rootPath, filePath);
        
        fileInventory.files.push({
          path: filePath,
          relativePath: relativePath,
          type: this.classifyFile(filePath),
          size: stats.size,
          lastModified: stats.mtime
        });
      }
    }

    fileInventory.totalFiles = fileInventory.files.length;

    return fileInventory;
  }

  /**
   * Check if file should be included based on patterns
   * @param {string} filePath - File to check
   * @param {Object} options - Include/exclude patterns
   * @param {string[]} options.excludePatterns - Patterns to exclude
   * @param {string[]} options.fileExtensions - Extensions to include
   * @returns {boolean} True if file should be analyzed
   */
  shouldIncludeFile(filePath, options = {}) {
    const {
      excludePatterns = [],
      fileExtensions = ['.js', '.ts']
    } = options;

    // Check file extension
    const ext = path.extname(filePath);
    if (!fileExtensions.includes(ext)) {
      return false;
    }

    // Check against ignore patterns using relative path
    if (this.ignoreFilter && this.rootPath) {
      const relativePath = path.relative(this.rootPath, filePath).replace(/\\/g, '/');
      if (this.ignoreFilter.ignores(relativePath)) {
        return false;
      }
    }

    // Additional check for common patterns to exclude
    const normalizedPath = filePath.replace(/\\/g, '/');
    for (const pattern of excludePatterns) {
      const regexPattern = pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\//g, '\\/');
      
      const regex = new RegExp(regexPattern);
      if (regex.test(normalizedPath)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Determine file type based on extension and content
   * @param {string} filePath - File to classify
   * @returns {string} Classification result: 'javascript', 'typescript', 'json', or 'other'
   */
  classifyFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.js':
      case '.jsx':
      case '.mjs':
      case '.cjs':
        return 'javascript';
      
      case '.ts':
      case '.tsx':
        return 'typescript';
      
      case '.json':
        return 'json';
      
      default:
        return 'other';
    }
  }
}

module.exports = FileScanner;
