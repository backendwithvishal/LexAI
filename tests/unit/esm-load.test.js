/**
 * Bug Condition Exploration Test — Property 1
 *
 * Checks that all five codebase auditor files load without ERR_REQUIRE_ESM.
 * On UNFIXED code these tests FAIL — that failure proves the bug exists.
 * After the fix they should all PASS.
 */

describe('ESM load check — all five auditor modules', () => {
  // Each test tries a dynamic import and asserts no error was thrown.
  // A thrown ERR_REQUIRE_ESM means the file still uses require().

  it('src/index.js loads without error', async () => {
    let error = null;
    let exports = null;

    try {
      exports = await import('../../src/index.js');
    } catch (err) {
      error = err;
    }

    // If this fails with ERR_REQUIRE_ESM the bug is confirmed for index.js
    expect(error).toBeNull();
    expect(exports).not.toBeNull();
  });

  it('src/core/ConfigurationManager.js loads without error', async () => {
    let error = null;
    let exports = null;

    try {
      exports = await import('../../src/core/ConfigurationManager.js');
    } catch (err) {
      error = err;
    }

    // If this fails with ERR_REQUIRE_ESM the bug is confirmed for ConfigurationManager
    expect(error).toBeNull();
    expect(exports).not.toBeNull();
  });

  it('src/core/ProgressReporter.js loads without error', async () => {
    let error = null;
    let exports = null;

    try {
      exports = await import('../../src/core/ProgressReporter.js');
    } catch (err) {
      error = err;
    }

    // If this fails with ERR_REQUIRE_ESM the bug is confirmed for ProgressReporter
    expect(error).toBeNull();
    expect(exports).not.toBeNull();
  });

  it('src/parser/CodeParser.js loads without error', async () => {
    let error = null;
    let exports = null;

    try {
      exports = await import('../../src/parser/CodeParser.js');
    } catch (err) {
      error = err;
    }

    // If this fails with ERR_REQUIRE_ESM the bug is confirmed for CodeParser
    expect(error).toBeNull();
    expect(exports).not.toBeNull();
  });

  it('src/scanner/FileScanner.js loads without error', async () => {
    let error = null;
    let exports = null;

    try {
      exports = await import('../../src/scanner/FileScanner.js');
    } catch (err) {
      error = err;
    }

    // If this fails with ERR_REQUIRE_ESM the bug is confirmed for FileScanner
    expect(error).toBeNull();
    expect(exports).not.toBeNull();
  });
});
