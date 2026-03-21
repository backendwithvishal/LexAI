import { ConfigurationManager, ConfigurationError } from '../../src/core/ConfigurationManager.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM doesn't have __dirname — derive it from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ConfigurationManager', () => {
  let configManager;
  let tempDir;

  beforeEach(() => {
    configManager = new ConfigurationManager();
    tempDir = path.join(__dirname, '../temp');
  });

  afterEach(async () => {
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('getDefaultConfiguration', () => {
    it('should return valid default configuration', () => {
      const config = configManager.getDefaultConfiguration();

      expect(config).toHaveProperty('scan');
      expect(config).toHaveProperty('checks');
      expect(config).toHaveProperty('severity');
      expect(config).toHaveProperty('output');
      expect(config.scan.rootDirectory).toBe('.');
      expect(config.scan.includePatterns).toContain('**/*.js');
      expect(config.scan.includePatterns).toContain('**/*.ts');
      expect(config.checks.incompleteFunctions).toBe(true);
      expect(config.severity.syntaxError).toBe('CRITICAL');
      expect(config.output.formats).toContain('json');
    });

    it('should have all required fields', () => {
      const config = configManager.getDefaultConfiguration();

      expect(config.scan).toHaveProperty('rootDirectory');
      expect(config.scan).toHaveProperty('includePatterns');
      expect(config.scan).toHaveProperty('excludePatterns');
      expect(config.scan).toHaveProperty('fileExtensions');
      expect(config.checks).toHaveProperty('incompleteFunctions');
      expect(config.checks).toHaveProperty('todoMarkers');
      expect(config.severity).toHaveProperty('syntaxError');
      expect(config.output).toHaveProperty('directory');
      expect(config.output).toHaveProperty('formats');
      expect(config.output).toHaveProperty('generatePostman');
    });
  });

  describe('validateConfiguration', () => {
    it('should validate correct configuration', () => {
      const config = configManager.getDefaultConfiguration();
      expect(() => configManager.validateConfiguration(config)).not.toThrow();
    });

    it('should throw error for missing required fields', () => {
      const invalidConfig = {
        scan: {
          rootDirectory: '.'
          // Missing required fields
        }
      };

      expect(() => configManager.validateConfiguration(invalidConfig)).toThrow(ConfigurationError);
    });

    it('should throw error for invalid severity value', () => {
      const config = configManager.getDefaultConfiguration();
      config.severity.syntaxError = 'INVALID';

      expect(() => configManager.validateConfiguration(config)).toThrow(ConfigurationError);
    });

    it('should throw error for non-existent root directory', () => {
      const config = configManager.getDefaultConfiguration();
      config.scan.rootDirectory = '/non/existent/path';

      expect(() => configManager.validateConfiguration(config)).toThrow(ConfigurationError);
      expect(() => configManager.validateConfiguration(config)).toThrow(/does not exist/);
    });

    it('should throw error for empty includePatterns', () => {
      const config = configManager.getDefaultConfiguration();
      config.scan.includePatterns = [];

      expect(() => configManager.validateConfiguration(config)).toThrow(ConfigurationError);
    });

    it('should throw error for invalid output format', () => {
      const config = configManager.getDefaultConfiguration();
      config.output.formats = ['invalid'];

      expect(() => configManager.validateConfiguration(config)).toThrow(ConfigurationError);
    });
  });

  describe('loadConfiguration', () => {
    it('should load configuration from file', async () => {
      await fs.ensureDir(tempDir);
      const configPath = path.join(tempDir, 'test-config.json');
      const testConfig = configManager.getDefaultConfiguration();
      testConfig.scan.rootDirectory = tempDir;
      await fs.writeJson(configPath, testConfig);

      const config = await configManager.loadConfiguration(configPath);

      expect(config).toEqual(testConfig);
    });

    it('should throw error for non-existent config file', async () => {
      const configPath = path.join(tempDir, 'non-existent.json');

      await expect(configManager.loadConfiguration(configPath)).rejects.toThrow(ConfigurationError);
      await expect(configManager.loadConfiguration(configPath)).rejects.toThrow(/not found/);
    });

    it('should throw error for invalid JSON', async () => {
      await fs.ensureDir(tempDir);
      const configPath = path.join(tempDir, 'invalid.json');
      await fs.writeFile(configPath, 'invalid json content');

      await expect(configManager.loadConfiguration(configPath)).rejects.toThrow(ConfigurationError);
      await expect(configManager.loadConfiguration(configPath)).rejects.toThrow(/Failed to parse/);
    });

    it('should use defaults when no path provided', async () => {
      const config = await configManager.loadConfiguration();

      expect(config).toEqual(configManager.getDefaultConfiguration());
    });

    it('should validate loaded configuration', async () => {
      await fs.ensureDir(tempDir);
      const configPath = path.join(tempDir, 'invalid-config.json');
      const invalidConfig = {
        scan: {
          rootDirectory: tempDir
          // Missing required fields
        }
      };
      await fs.writeJson(configPath, invalidConfig);

      await expect(configManager.loadConfiguration(configPath)).rejects.toThrow(ConfigurationError);
    });
  });

  describe('ConfigurationError', () => {
    it('should create error with field and value', () => {
      const error = new ConfigurationError('Test error', 'testField', 'testValue');

      expect(error.message).toBe('Test error');
      expect(error.name).toBe('ConfigurationError');
      expect(error.field).toBe('testField');
      expect(error.value).toBe('testValue');
    });
  });
});
