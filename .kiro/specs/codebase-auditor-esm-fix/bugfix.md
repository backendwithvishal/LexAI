# Bugfix Requirements Document

## Introduction

The project declares `"type": "module"` in `package.json`, which instructs Node.js to treat all `.js` files as ES modules (ESM). However, five source files in the codebase auditor tool were written using CommonJS syntax (`require()` / `module.exports`). When Node.js attempts to load any of these files at runtime, it throws an `ERR_REQUIRE_ESM` error and crashes immediately. The fix is to convert all five files to ESM syntax (`import` / `export`) while preserving all existing logic, security hardening, and behavior.

Affected files:
- `src/index.js`
- `src/core/ConfigurationManager.js`
- `src/core/ProgressReporter.js`
- `src/parser/CodeParser.js`
- `src/scanner/FileScanner.js`

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN any of the five affected files is loaded by Node.js THEN the runtime throws `ERR_REQUIRE_ESM` and the process crashes because `require()` is not available in an ESM context.

1.2 WHEN `src/index.js` is imported THEN the system crashes because it uses `require('./core/ConfigurationManager')` and `module.exports = { ... }`.

1.3 WHEN `src/core/ConfigurationManager.js` is loaded THEN the system crashes because it uses `const fs = require('fs-extra')`, `const Ajv = require('ajv')`, and `module.exports = { ConfigurationManager, ConfigurationError }`.

1.4 WHEN `src/core/ProgressReporter.js` is loaded THEN the system crashes because it uses `const EventEmitter = require('events')`, `const cliProgress = require('cli-progress')`, and `module.exports = ProgressReporter`.

1.5 WHEN `src/parser/CodeParser.js` is loaded THEN the system crashes because it uses `const babelParser = require('@babel/parser')`, `const traverse = require('@babel/traverse').default`, `const t = require('@babel/types')`, `const fs = require('fs-extra')`, and `module.exports = CodeParser`.

1.6 WHEN `src/scanner/FileScanner.js` is loaded THEN the system crashes because it uses `const fastGlob = require('fast-glob')`, `const ignore = require('ignore')`, `const fs = require('fs-extra')`, `const path = require('path')`, and `module.exports = FileScanner`.

### Expected Behavior (Correct)

2.1 WHEN any of the five affected files is loaded by Node.js THEN the system SHALL load successfully without throwing `ERR_REQUIRE_ESM` or any module-related error.

2.2 WHEN `src/index.js` is imported THEN the system SHALL use `import { ConfigurationManager, ConfigurationError } from './core/ConfigurationManager.js'` and `export { ConfigurationManager, ConfigurationError }`.

2.3 WHEN `src/core/ConfigurationManager.js` is loaded THEN the system SHALL use `import fs from 'fs-extra'`, `import Ajv from 'ajv'`, and `export { ConfigurationManager, ConfigurationError }`, preserving all validation logic and security checks.

2.4 WHEN `src/core/ProgressReporter.js` is loaded THEN the system SHALL use `import EventEmitter from 'events'`, `import cliProgress from 'cli-progress'`, and `export default ProgressReporter`, preserving all event emission and progress bar behavior.

2.5 WHEN `src/parser/CodeParser.js` is loaded THEN the system SHALL use `import babelParser from '@babel/parser'`, `import traverse from '@babel/traverse'`, `import * as t from '@babel/types'`, `import fs from 'fs-extra'`, and `export default CodeParser`, preserving all AST parsing and extraction logic.

2.6 WHEN `src/scanner/FileScanner.js` is loaded THEN the system SHALL use `import fastGlob from 'fast-glob'`, `import ignore from 'ignore'`, `import fs from 'fs-extra'`, `import path from 'path'`, and `export default FileScanner`, preserving all file discovery and filtering logic.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `ConfigurationManager.loadConfiguration()` is called with a valid config file path THEN the system SHALL CONTINUE TO read, parse, and validate the configuration file correctly.

3.2 WHEN `ConfigurationManager.loadConfiguration()` is called with no arguments THEN the system SHALL CONTINUE TO return the full default configuration object unchanged.

3.3 WHEN `ConfigurationManager.validateConfiguration()` is called with an invalid config THEN the system SHALL CONTINUE TO throw a `ConfigurationError` with descriptive field and value information.

3.4 WHEN `ProgressReporter.reportScanProgress()` is called THEN the system SHALL CONTINUE TO emit a `scanProgress` event and update the console progress bar.

3.5 WHEN `ProgressReporter.reportAnalysisProgress()` is called THEN the system SHALL CONTINUE TO emit an `analysisProgress` event with the current file name and percentage.

3.6 WHEN `ProgressReporter.stop()` is called THEN the system SHALL CONTINUE TO stop all progress bars and clear the internal map.

3.7 WHEN `CodeParser.parseFile()` is called with a valid JS/TS file THEN the system SHALL CONTINUE TO return an AST with extracted functions, classes, imports, exports, and comments.

3.8 WHEN `CodeParser.parseFile()` encounters a syntax error THEN the system SHALL CONTINUE TO return a result object with an `errors` array rather than throwing.

3.9 WHEN `FileScanner.scanDirectory()` is called with a root path and options THEN the system SHALL CONTINUE TO return a file inventory with `totalFiles` count and a `files` array containing path, relativePath, type, size, and lastModified.

3.10 WHEN `FileScanner.shouldIncludeFile()` is called with a file matching an exclude pattern THEN the system SHALL CONTINUE TO return `false` for that file.

3.11 WHEN the rest of the codebase (controllers, services, middleware, models) imports from these modules THEN the system SHALL CONTINUE TO function correctly with no changes required to those files.

---

## Bug Condition Pseudocode

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type SourceFile
  OUTPUT: boolean

  // A file triggers the bug if it uses CommonJS syntax in an ESM project
  RETURN X.usesRequire = true OR X.usesModuleExports = true
END FUNCTION
```

```pascal
// Property: Fix Checking
FOR ALL X WHERE isBugCondition(X) DO
  result ← loadModule'(X)
  ASSERT result.error IS NULL
  ASSERT result.exports IS NOT NULL
END FOR
```

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT loadModule(X).behavior = loadModule'(X).behavior
END FOR
```
