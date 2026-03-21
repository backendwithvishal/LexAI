/**
 * Master Codebase Auditor & Tester
 * Main entry point for programmatic API
 */

// ESM import — explicit .js extension required in ESM projects
import { ConfigurationManager, ConfigurationError } from './core/ConfigurationManager.js';

// Re-export both classes so callers can import them from this entry point
export { ConfigurationManager, ConfigurationError };
