# Master Codebase Auditor & Tester

A comprehensive static analysis and validation system for Node.js/Express backend applications. The system performs multi-layered analysis including code quality auditing, data flow validation, API functional testing, and automated documentation generation.

## Features

- **Code Quality Assurance**: Identify complete implementations, logic errors, and anti-patterns
- **Data Integrity Validation**: Verify database operations align with schema definitions
- **API Correctness**: Validate endpoint functionality, middleware chains, and response contracts
- **Documentation Automation**: Generate Postman collections for discovered API endpoints
- **Actionable Reporting**: Provide severity-classified findings with remediation guidance

## Installation

```bash
npm install codebase-auditor-tester
```

## Quick Start

### CLI Usage

```bash
# Basic usage - audit current directory
npx codebase-auditor

# With custom config
npx codebase-auditor --config ./my-config.json

# Specify root directory
npx codebase-auditor --root ./src

# Output format selection
npx codebase-auditor --format json,markdown

# Skip specific checks
npx codebase-auditor --skip todoMarkers,unusedVariables

# Generate only Postman collection
npx codebase-auditor --postman-only

# Verbose output
npx codebase-auditor --verbose
```

### Programmatic API

```javascript
const { AuditorController, ConfigurationManager } = require('codebase-auditor-tester');

// Load configuration
const configManager = new ConfigurationManager();
const config = await configManager.loadConfiguration('./audit-config.json');

// Create controller
const auditor = new AuditorController();

// Execute audit
const result = await auditor.executeAudit(config);
console.log(`Audit complete: ${result.summary.totalIssues} issues found`);
console.log(`Reports written to: ${config.output.directory}`);

// With progress reporting
auditor.on('progress', (event) => {
  console.log(`${event.phase}: ${event.percentage}%`);
});

auditor.on('phaseComplete', (event) => {
  console.log(`${event.phase} completed in ${event.duration}ms`);
});
```

## Configuration

Create a configuration file (e.g., `audit-config.json`):

```json
{
  "scan": {
    "rootDirectory": ".",
    "includePatterns": ["**/*.js", "**/*.ts"],
    "excludePatterns": [
      "node_modules/**",
      ".git/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "*.test.js",
      "*.spec.js"
    ],
    "fileExtensions": [".js", ".ts"]
  },
  "checks": {
    "incompleteFunctions": true,
    "todoMarkers": true,
    "edgeCases": true,
    "logicErrors": true,
    "variableValidation": true,
    "dataFlowValidation": true,
    "apiValidation": true
  },
  "severity": {
    "syntaxError": "CRITICAL",
    "missingErrorHandling": "HIGH",
    "incompleteFunctions": "HIGH",
    "todoMarkers": "MEDIUM",
    "unusedVariables": "LOW"
  },
  "output": {
    "directory": "./audit-results",
    "formats": ["json", "markdown", "html"],
    "generatePostman": true
  }
}
```

## Output

The auditor generates:

- **Audit Reports**: JSON, Markdown, and HTML formats with detailed findings
- **Postman Collection**: Ready-to-use API documentation and testing collection
- **Issue Classification**: Severity-based grouping (CRITICAL, HIGH, MEDIUM, LOW)
- **Recommendations**: Actionable guidance for fixing detected issues

## Target Environment

- **Runtime**: Node.js (v14+)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Message Queue**: RabbitMQ
- **Cache**: Redis
- **Real-time**: Socket.io

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

## License

MIT
