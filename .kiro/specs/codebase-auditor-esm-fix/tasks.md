# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - CJS Modules Crash in ESM Project
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate ERR_REQUIRE_ESM for all five affected files
  - **Scoped PBT Approach**: Scope the property to the five concrete failing files; for each, attempt a dynamic `import()` and assert no error is thrown
  - Create `tests/unit/esm-load.test.js` using ESM `import` syntax
  - For each of the five files, use `import()` inside a try/catch and assert `error` is `null` and `exports` is not `null`:
    - `import('../../src/index.js')`
    - `import('../../src/core/ConfigurationManager.js')`
    - `import('../../src/core/ProgressReporter.js')`
    - `import('../../src/parser/CodeParser.js')`
    - `import('../../src/scanner/FileScanner.js')`
  - Run test on UNFIXED code: `npx jest tests/unit/esm-load.test.js --experimental-vm-modules`
  - **EXPECTED OUTCOME**: All five assertions FAIL with `ERR_REQUIRE_ESM` (this is correct — it proves the bug exists)
  - Document counterexamples found (e.g., `import('../../src/index.js')` throws `ERR_REQUIRE_ESM`)
  - Mark task complete when test is written, run, and all five failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Runtime Behavior Is Identical After Fix
  - **IMPORTANT**: Follow observation-first methodology — observe behavior on UNFIXED code for non-buggy inputs
  - Because the source modules crash on load, observe behavior via the existing CJS test files directly (they import via `require()` which also fails, but the test logic captures the expected behavior)
  - Review existing tests in `tests/unit/ConfigurationManager.test.js`, `tests/unit/core/ProgressReporter.test.js`, `tests/unit/parser/CodeParser.test.js`, `tests/unit/scanner/FileScanner.test.js` — these encode the preserved behaviors
  - Convert all four test files from CJS to ESM syntax (this is the preservation test suite):
    - Replace `const { ConfigurationManager, ConfigurationError } = require('../../src/core/ConfigurationManager')` → `import { ConfigurationManager, ConfigurationError } from '../../src/core/ConfigurationManager.js'`
    - Replace `const fs = require('fs-extra')` → `import fs from 'fs-extra'`
    - Replace `const path = require('path')` → `import path from 'path'`
    - Replace `const ProgressReporter = require('../../../src/core/ProgressReporter')` → `import ProgressReporter from '../../../src/core/ProgressReporter.js'`
    - Replace `const CodeParser = require('../../../src/parser/CodeParser')` → `import CodeParser from '../../../src/parser/CodeParser.js'`
    - Replace `const FileScanner = require('../../../src/scanner/FileScanner')` → `import FileScanner from '../../../src/scanner/FileScanner.js'`
    - Replace `const os = require('os')` → `import os from 'os'`
  - Run converted tests on UNFIXED code: `npx jest tests/unit/ --experimental-vm-modules`
  - **EXPECTED OUTCOME**: Tests FAIL because source modules still use CJS (confirms baseline behavior is captured, not yet loadable)
  - Mark task complete when all four test files are converted to ESM and run attempted on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11_

- [x] 3. Fix: Convert five CJS source files to ESM

  - [x] 3.1 Convert `src/index.js` from CJS to ESM
    - Replace `const { ConfigurationManager, ConfigurationError } = require('./core/ConfigurationManager')` with `import { ConfigurationManager, ConfigurationError } from './core/ConfigurationManager.js'`
    - Replace `module.exports = { ConfigurationManager, ConfigurationError }` with `export { ConfigurationManager, ConfigurationError }`
    - Note: ESM requires explicit `.js` extensions in relative imports
    - _Bug_Condition: isBugCondition(src/index.js) — file uses require() and module.exports_
    - _Expected_Behavior: file loads without ERR_REQUIRE_ESM; named exports ConfigurationManager and ConfigurationError are accessible_
    - _Preservation: all callers of ConfigurationManager and ConfigurationError continue to work identically_
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 Convert `src/core/ConfigurationManager.js` from CJS to ESM
    - Replace `const fs = require('fs-extra')` with `import fs from 'fs-extra'`
    - Replace `const path = require('path')` with `import path from 'path'`
    - Replace `const Ajv = require('ajv')` with `import Ajv from 'ajv'`
    - Replace `module.exports = { ConfigurationManager, ConfigurationError }` with `export { ConfigurationManager, ConfigurationError }`
    - _Bug_Condition: isBugCondition(src/core/ConfigurationManager.js) — file uses require() and module.exports_
    - _Expected_Behavior: file loads without error; ConfigurationManager and ConfigurationError are accessible as named exports_
    - _Preservation: loadConfiguration(), validateConfiguration(), getDefaultConfiguration() behavior unchanged; ConfigurationError still has field and value properties_
    - _Requirements: 2.1, 2.3, 3.1, 3.2, 3.3_

  - [x] 3.3 Convert `src/core/ProgressReporter.js` from CJS to ESM
    - Replace `const EventEmitter = require('events')` with `import EventEmitter from 'events'`
    - Replace `const cliProgress = require('cli-progress')` with `import cliProgress from 'cli-progress'`
    - Replace `module.exports = ProgressReporter` with `export default ProgressReporter`
    - _Bug_Condition: isBugCondition(src/core/ProgressReporter.js) — file uses require() and module.exports_
    - _Expected_Behavior: file loads without error; ProgressReporter is accessible as default export and is a callable constructor_
    - _Preservation: EventEmitter inheritance preserved; scanProgress, analysisProgress, phaseComplete, overallProgress events emitted with same payloads; stop() clears progressBars map_
    - _Requirements: 2.1, 2.4, 3.4, 3.5, 3.6_

  - [x] 3.4 Convert `src/parser/CodeParser.js` from CJS to ESM
    - Replace `const babelParser = require('@babel/parser')` with `import babelParser from '@babel/parser'`
    - Replace `const traverse = require('@babel/traverse').default` with `import traverse from '@babel/traverse'` (drop the `.default` access — ESM default import handles this)
    - Replace `const t = require('@babel/types')` with `import * as t from '@babel/types'` (namespace import preserves all `t.isIdentifier()`, `t.isArrowFunctionExpression()` etc. call patterns)
    - Replace `const fs = require('fs-extra')` with `import fs from 'fs-extra'`
    - Replace `module.exports = CodeParser` with `export default CodeParser`
    - _Bug_Condition: isBugCondition(src/parser/CodeParser.js) — file uses require() and module.exports_
    - _Expected_Behavior: file loads without error; CodeParser is accessible as default export; @babel/traverse default import and @babel/types namespace import work correctly_
    - _Preservation: parseFile() returns same { filePath, ast, functions, classes, imports, exports, comments, errors } shape; syntax errors returned in errors array not thrown; all t.* helper calls work identically_
    - _Requirements: 2.1, 2.5, 3.7, 3.8_

  - [x] 3.5 Convert `src/scanner/FileScanner.js` from CJS to ESM
    - Replace `const fastGlob = require('fast-glob')` with `import fastGlob from 'fast-glob'`
    - Replace `const ignore = require('ignore')` with `import ignore from 'ignore'`
    - Replace `const fs = require('fs-extra')` with `import fs from 'fs-extra'`
    - Replace `const path = require('path')` with `import path from 'path'`
    - Replace `module.exports = FileScanner` with `export default FileScanner`
    - _Bug_Condition: isBugCondition(src/scanner/FileScanner.js) — file uses require() and module.exports_
    - _Expected_Behavior: file loads without error; FileScanner is accessible as default export and is a callable constructor_
    - _Preservation: scanDirectory() returns same { totalFiles, files[] } shape with path, relativePath, type, size, lastModified; shouldIncludeFile() returns false for excluded patterns; classifyFile() returns same classification strings_
    - _Requirements: 2.1, 2.6, 3.9, 3.10, 3.11_

  - [x] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - CJS Modules Load Without Error After Fix
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior (all five dynamic imports succeed without ERR_REQUIRE_ESM)
    - Run: `npx jest tests/unit/esm-load.test.js --experimental-vm-modules`
    - **EXPECTED OUTCOME**: All five assertions PASS (confirms bug is fixed for all affected files)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Runtime Behavior Is Identical After Fix
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run: `npx jest tests/unit/ --experimental-vm-modules`
    - **EXPECTED OUTCOME**: All tests in ConfigurationManager.test.js, ProgressReporter.test.js, CodeParser.test.js, FileScanner.test.js PASS (confirms no regressions)
    - Confirm all class methods, event emissions, return shapes, and error types are identical to pre-fix behavior
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11_

- [x] 4. Checkpoint — Ensure all tests pass
  - Run the full test suite: `npx jest --experimental-vm-modules`
  - Confirm esm-load.test.js passes (all five modules load without error)
  - Confirm all four unit test files pass (no regressions in behavior)
  - If any test fails, investigate and resolve before marking complete
  - Ask the user if questions arise
