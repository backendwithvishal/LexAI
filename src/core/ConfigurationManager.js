// ESM imports — default imports for these CommonJS-style packages
import fs from 'fs-extra';
import path from 'path';
import Ajv from 'ajv';

/**
 * ConfigurationError - Custom error for configuration issues
 */
class ConfigurationError extends Error {
  constructor(message, field, value) {
    super(message);
    this.name = 'ConfigurationError';
    this.field = field;
    this.value = value;
  }
}

/**
 * ConfigurationManager - Manages loading, validation, and defaults for audit configuration
 */
class ConfigurationManager {
  constructor() {
    this.ajv = new Ajv({ allErrors: true });
    this.schema = this._getConfigurationSchema();
    this.validator = this.ajv.compile(this.schema);
  }

  /**
   * Load configuration from file or use defaults
   * @param {string} configPath - Path to config file (optional)
   * @returns {object} Validated configuration object
   */
  async loadConfiguration(configPath = null) {
    let config;

    if (configPath) {
      // Load from file
      try {
        const configContent = await fs.readFile(configPath, 'utf-8');
        config = JSON.parse(configContent);
      } catch (error) {
        if (error.code === 'ENOENT') {
          throw new ConfigurationError(
            `Configuration file not found: ${configPath}`,
            'configPath',
            configPath
          );
        }
        throw new ConfigurationError(
          `Failed to parse configuration file: ${error.message}`,
          'configPath',
          configPath
        );
      }
    } else {
      // Use defaults
      config = this.getDefaultConfiguration();
    }

    // Validate configuration
    this.validateConfiguration(config);

    return config;
  }

  /**
   * Validate configuration structure and values
   * @param {object} config - Raw configuration object
   * @returns {boolean} True if valid
   * @throws {ConfigurationError} If invalid
   */
  validateConfiguration(config) {
    const valid = this.validator(config);

    if (!valid) {
      const errors = this.validator.errors
        .map(err => `${err.instancePath} ${err.message}`)
        .join(', ');
      throw new ConfigurationError(
        `Configuration validation failed: ${errors}`,
        'configuration',
        config
      );
    }

    // Additional validation: check if rootDirectory exists
    if (config.scan && config.scan.rootDirectory) {
      const rootDir = path.resolve(config.scan.rootDirectory);
      if (!fs.existsSync(rootDir)) {
        throw new ConfigurationError(
          `Root directory does not exist: ${rootDir}`,
          'scan.rootDirectory',
          config.scan.rootDirectory
        );
      }
    }

    return true;
  }

  /**
   * Get default configuration for Node.js/Express projects
   * @returns {object} Default configuration
   */
  getDefaultConfiguration() {
    return {
      scan: {
        rootDirectory: '.',
        includePatterns: ['**/*.js', '**/*.ts'],
        excludePatterns: [
          'node_modules/**',
          '.git/**',
          'dist/**',
          'build/**',
          'coverage/**',
          '*.test.js',
          '*.spec.js'
        ],
        fileExtensions: ['.js', '.ts']
      },
      checks: {
        incompleteFunctions: true,
        todoMarkers: true,
        edgeCases: true,
        logicErrors: true,
        variableValidation: true,
        dataFlowValidation: true,
        apiValidation: true
      },
      severity: {
        syntaxError: 'CRITICAL',
        missingErrorHandling: 'HIGH',
        incompleteFunctions: 'HIGH',
        todoMarkers: 'MEDIUM',
        unusedVariables: 'LOW',
        unreachableCode: 'MEDIUM',
        invalidQuery: 'HIGH',
        missingValidation: 'HIGH'
      },
      output: {
        directory: './audit-results',
        formats: ['json', 'markdown', 'html'],
        generatePostman: true
      },
      database: {
        modelPatterns: ['**/models/**/*.js', '**/schemas/**/*.js']
      },
      api: {
        routePatterns: ['**/routes/**/*.js', '**/controllers/**/*.js'],
        baseUrl: 'http://localhost:3000'
      }
    };
  }

  /**
   * Get JSON schema for configuration validation
   * @returns {object} JSON schema
   * @private
   */
  _getConfigurationSchema() {
    return {
      type: 'object',
      required: ['scan', 'checks', 'severity', 'output'],
      properties: {
        scan: {
          type: 'object',
          required: ['rootDirectory', 'includePatterns', 'excludePatterns', 'fileExtensions'],
          properties: {
            rootDirectory: { type: 'string' },
            includePatterns: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1
            },
            excludePatterns: {
              type: 'array',
              items: { type: 'string' }
            },
            fileExtensions: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1
            }
          }
        },
        checks: {
          type: 'object',
          properties: {
            incompleteFunctions: { type: 'boolean' },
            todoMarkers: { type: 'boolean' },
            edgeCases: { type: 'boolean' },
            logicErrors: { type: 'boolean' },
            variableValidation: { type: 'boolean' },
            dataFlowValidation: { type: 'boolean' },
            apiValidation: { type: 'boolean' }
          }
        },
        severity: {
          type: 'object',
          properties: {
            syntaxError: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
            missingErrorHandling: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
            incompleteFunctions: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
            todoMarkers: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
            unusedVariables: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
            unreachableCode: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
            invalidQuery: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
            missingValidation: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] }
          }
        },
        output: {
          type: 'object',
          required: ['directory', 'formats', 'generatePostman'],
          properties: {
            directory: { type: 'string' },
            formats: {
              type: 'array',
              items: { type: 'string', enum: ['json', 'markdown', 'html'] },
              minItems: 1
            },
            generatePostman: { type: 'boolean' }
          }
        },
        database: {
          type: 'object',
          properties: {
            modelPatterns: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        },
        api: {
          type: 'object',
          properties: {
            routePatterns: {
              type: 'array',
              items: { type: 'string' }
            },
            baseUrl: { type: 'string' }
          }
        }
      }
    };
  }
}

// Named exports — both classes are needed by src/index.js
export { ConfigurationManager, ConfigurationError };
