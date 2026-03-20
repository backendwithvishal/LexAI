const babelParser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');
const fs = require('fs-extra');

/**
 * CodeParser - Parses JavaScript/TypeScript files into AST and extracts code elements
 * 
 * Responsibilities:
 * - Parse source code into Abstract Syntax Trees using @babel/parser
 * - Handle syntax errors gracefully and record them
 * - Extract all function declarations, arrow functions, and methods
 * - Extract all class definitions
 * - Extract all import/export statements
 * - Extract comments for marker detection
 * - Preserve source location information for all code elements
 */
class CodeParser {
  constructor() {
    this.parserOptions = {
      sourceType: 'module',
      plugins: [
        'jsx',
        'decorators-legacy',
        'classProperties',
        'classPrivateProperties',
        'classPrivateMethods',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'dynamicImport',
        'nullishCoalescingOperator',
        'optionalChaining',
        'objectRestSpread',
        'asyncGenerators'
      ],
      errorRecovery: true,
      allowReturnOutsideFunction: true,
      allowImportExportEverywhere: true,
      allowAwaitOutsideFunction: true,
      allowSuperOutsideMethod: true
    };
  }

  /**
   * Parse JavaScript/TypeScript file into AST
   * @param {string} filePath - File to parse
   * @param {string} content - File content (optional, will read from file if not provided)
   * @returns {Promise<ParseResult>} AST and metadata
   */
  async parseFile(filePath, content = null) {
    try {
      // Read file content if not provided
      const fileContent = content !== null ? content : await fs.readFile(filePath, 'utf-8');

      // Determine parser options based on file extension
      const options = { ...this.parserOptions };
      if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        options.plugins = [...options.plugins, 'typescript'];
      }

      // Parse the file with comments attached
      const ast = babelParser.parse(fileContent, {
        ...options,
        attachComment: true
      });

      // Extract all code elements
      const functions = this.extractFunctions(ast);
      const classes = this.extractClasses(ast);
      const { imports, exports } = this.extractImportsExports(ast);
      const comments = this.extractComments(ast);

      return {
        filePath,
        ast,
        functions,
        classes,
        imports,
        exports,
        comments,
        errors: []
      };
    } catch (error) {
      // Handle parse errors gracefully
      return {
        filePath,
        ast: null,
        functions: [],
        classes: [],
        imports: [],
        exports: [],
        comments: [],
        errors: [{
          message: error.message,
          line: error.loc?.line || 0,
          column: error.loc?.column || 0,
          reasonCode: error.reasonCode || 'PARSE_ERROR'
        }]
      };
    }
  }

  /**
   * Extract all function declarations from AST
   * Includes: function declarations, arrow functions, and methods
   * @param {AST} ast - Abstract syntax tree
   * @returns {FunctionDeclaration[]} List of functions
   */
  extractFunctions(ast) {
    const functions = [];
    const self = this;

    traverse(ast, {
      // Regular function declarations: function foo() {}
      FunctionDeclaration(path) {
        functions.push({
          name: path.node.id?.name || '<anonymous>',
          type: 'function',
          params: path.node.params.map(param => self._extractParamName(param)),
          async: path.node.async || false,
          generator: path.node.generator || false,
          location: {
            start: {
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0
            },
            end: {
              line: path.node.loc?.end.line || 0,
              column: path.node.loc?.end.column || 0
            }
          },
          body: path.node.body
        });
      },

      // Arrow functions: const foo = () => {}
      VariableDeclarator(path) {
        if (t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init)) {
          const func = path.node.init;
          functions.push({
            name: path.node.id?.name || '<anonymous>',
            type: 'arrow',
            params: func.params.map(param => self._extractParamName(param)),
            async: func.async || false,
            generator: func.generator || false,
            location: {
              start: {
                line: func.loc?.start.line || 0,
                column: func.loc?.start.column || 0
              },
              end: {
                line: func.loc?.end.line || 0,
                column: func.loc?.end.column || 0
              }
            },
            body: func.body
          });
        }
      },

      // Class methods and object methods
      ClassMethod(path) {
        functions.push({
          name: self._extractMethodName(path.node.key),
          type: 'method',
          params: path.node.params.map(param => self._extractParamName(param)),
          async: path.node.async || false,
          generator: path.node.generator || false,
          static: path.node.static || false,
          kind: path.node.kind, // 'constructor', 'method', 'get', 'set'
          location: {
            start: {
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0
            },
            end: {
              line: path.node.loc?.end.line || 0,
              column: path.node.loc?.end.column || 0
            }
          },
          body: path.node.body
        });
      },

      // Object methods: { foo() {} }
      ObjectMethod(path) {
        functions.push({
          name: self._extractMethodName(path.node.key),
          type: 'method',
          params: path.node.params.map(param => self._extractParamName(param)),
          async: path.node.async || false,
          generator: path.node.generator || false,
          kind: path.node.kind,
          location: {
            start: {
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0
            },
            end: {
              line: path.node.loc?.end.line || 0,
              column: path.node.loc?.end.column || 0
            }
          },
          body: path.node.body
        });
      }
    });

    return functions;
  }

  /**
   * Extract all class definitions from AST
   * @param {AST} ast - Abstract syntax tree
   * @returns {ClassDeclaration[]} List of classes
   */
  extractClasses(ast) {
    const classes = [];
    const self = this;

    traverse(ast, {
      ClassDeclaration(path) {
        const classInfo = {
          name: path.node.id?.name || '<anonymous>',
          superClass: path.node.superClass?.name || null,
          methods: [],
          properties: [],
          location: {
            start: {
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0
            },
            end: {
              line: path.node.loc?.end.line || 0,
              column: path.node.loc?.end.column || 0
            }
          }
        };

        // Extract methods
        path.node.body.body.forEach(member => {
          if (t.isClassMethod(member) || t.isClassPrivateMethod(member)) {
            classInfo.methods.push({
              name: member.computed ? '<computed>' : self._extractMethodName(member.key),
              kind: member.kind,
              static: member.static || false,
              async: member.async || false,
              generator: member.generator || false,
              location: {
                start: {
                  line: member.loc?.start.line || 0,
                  column: member.loc?.start.column || 0
                },
                end: {
                  line: member.loc?.end.line || 0,
                  column: member.loc?.end.column || 0
                }
              }
            });
          } else if (t.isClassProperty(member) || t.isClassPrivateProperty(member)) {
            classInfo.properties.push({
              name: member.computed ? '<computed>' : self._extractPropertyName(member.key),
              static: member.static || false,
              location: {
                start: {
                  line: member.loc?.start.line || 0,
                  column: member.loc?.start.column || 0
                },
                end: {
                  line: member.loc?.end.line || 0,
                  column: member.loc?.end.column || 0
                }
              }
            });
          }
        });

        classes.push(classInfo);
      },

      // Class expressions: const MyClass = class {}
      VariableDeclarator(path) {
        if (t.isClassExpression(path.node.init)) {
          const classNode = path.node.init;
          const classInfo = {
            name: path.node.id?.name || classNode.id?.name || '<anonymous>',
            superClass: classNode.superClass?.name || null,
            methods: [],
            properties: [],
            location: {
              start: {
                line: classNode.loc?.start.line || 0,
                column: classNode.loc?.start.column || 0
              },
              end: {
                line: classNode.loc?.end.line || 0,
                column: classNode.loc?.end.column || 0
              }
            }
          };

          // Extract methods and properties
          classNode.body.body.forEach(member => {
            if (t.isClassMethod(member) || t.isClassPrivateMethod(member)) {
              classInfo.methods.push({
                name: member.computed ? '<computed>' : self._extractMethodName(member.key),
                kind: member.kind,
                static: member.static || false,
                async: member.async || false,
                generator: member.generator || false,
                location: {
                  start: {
                    line: member.loc?.start.line || 0,
                    column: member.loc?.start.column || 0
                  },
                  end: {
                    line: member.loc?.end.line || 0,
                    column: member.loc?.end.column || 0
                  }
                }
              });
            } else if (t.isClassProperty(member) || t.isClassPrivateProperty(member)) {
              classInfo.properties.push({
                name: member.computed ? '<computed>' : self._extractPropertyName(member.key),
                static: member.static || false,
                location: {
                  start: {
                    line: member.loc?.start.line || 0,
                    column: member.loc?.start.column || 0
                  },
                  end: {
                    line: member.loc?.end.line || 0,
                    column: member.loc?.end.column || 0
                  }
                }
              });
            }
          });

          classes.push(classInfo);
        }
      }
    });

    return classes;
  }

  /**
   * Extract all import/export statements
   * @param {AST} ast - Abstract syntax tree
   * @returns {ImportExport} Object with imports and exports arrays
   */
  extractImportsExports(ast) {
    const imports = [];
    const exports = [];

    traverse(ast, {
      // Import statements: import { foo } from 'bar'
      ImportDeclaration(path) {
        imports.push({
          source: path.node.source.value,
          specifiers: path.node.specifiers.map(spec => {
            if (t.isImportDefaultSpecifier(spec)) {
              return {
                type: 'default',
                local: spec.local.name,
                imported: 'default'
              };
            } else if (t.isImportNamespaceSpecifier(spec)) {
              return {
                type: 'namespace',
                local: spec.local.name,
                imported: '*'
              };
            } else if (t.isImportSpecifier(spec)) {
              return {
                type: 'named',
                local: spec.local.name,
                imported: spec.imported.name
              };
            }
            return null;
          }).filter(Boolean),
          location: {
            start: {
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0
            },
            end: {
              line: path.node.loc?.end.line || 0,
              column: path.node.loc?.end.column || 0
            }
          }
        });
      },

      // Export declarations
      ExportNamedDeclaration(path) {
        if (path.node.declaration) {
          // export const foo = 1; or export function foo() {}
          if (t.isVariableDeclaration(path.node.declaration)) {
            path.node.declaration.declarations.forEach(decl => {
              exports.push({
                name: decl.id.name,
                type: 'named',
                location: {
                  start: {
                    line: path.node.loc?.start.line || 0,
                    column: path.node.loc?.start.column || 0
                  },
                  end: {
                    line: path.node.loc?.end.line || 0,
                    column: path.node.loc?.end.column || 0
                  }
                }
              });
            });
          } else if (t.isFunctionDeclaration(path.node.declaration) || t.isClassDeclaration(path.node.declaration)) {
            exports.push({
              name: path.node.declaration.id?.name || '<anonymous>',
              type: 'named',
              location: {
                start: {
                  line: path.node.loc?.start.line || 0,
                  column: path.node.loc?.start.column || 0
                },
                end: {
                  line: path.node.loc?.end.line || 0,
                  column: path.node.loc?.end.column || 0
                }
              }
            });
          }
        } else if (path.node.specifiers) {
          // export { foo, bar }
          path.node.specifiers.forEach(spec => {
            exports.push({
              name: spec.exported.name,
              type: 'named',
              location: {
                start: {
                  line: path.node.loc?.start.line || 0,
                  column: path.node.loc?.start.column || 0
                },
                end: {
                  line: path.node.loc?.end.line || 0,
                  column: path.node.loc?.end.column || 0
                }
              }
            });
          });
        }
      },

      // export default
      ExportDefaultDeclaration(path) {
        let name = '<anonymous>';
        if (t.isIdentifier(path.node.declaration)) {
          name = path.node.declaration.name;
        } else if (t.isFunctionDeclaration(path.node.declaration) || t.isClassDeclaration(path.node.declaration)) {
          name = path.node.declaration.id?.name || '<anonymous>';
        }

        exports.push({
          name,
          type: 'default',
          location: {
            start: {
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0
            },
            end: {
              line: path.node.loc?.end.line || 0,
              column: path.node.loc?.end.column || 0
            }
          }
        });
      },

      // export * from 'module'
      ExportAllDeclaration(path) {
        exports.push({
          name: '*',
          type: 'all',
          source: path.node.source.value,
          location: {
            start: {
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0
            },
            end: {
              line: path.node.loc?.end.line || 0,
              column: path.node.loc?.end.column || 0
            }
          }
        });
      }
    });

    return { imports, exports };
  }

  /**
   * Extract comments from AST for marker detection
   * @param {AST} ast - Abstract syntax tree
   * @returns {Comment[]} List of comments
   */
  extractComments(ast) {
    if (!ast.comments) {
      return [];
    }

    return ast.comments.map(comment => ({
      type: comment.type === 'CommentBlock' ? 'block' : 'line',
      value: comment.value.trim(),
      location: {
        start: {
          line: comment.loc?.start.line || 0,
          column: comment.loc?.start.column || 0
        },
        end: {
          line: comment.loc?.end.line || 0,
          column: comment.loc?.end.column || 0
        }
      }
    }));
  }

  /**
   * Helper: Extract parameter name from various parameter types
   * @private
   */
  _extractParamName(param) {
    if (t.isIdentifier(param)) {
      return param.name;
    } else if (t.isRestElement(param)) {
      return `...${this._extractParamName(param.argument)}`;
    } else if (t.isAssignmentPattern(param)) {
      return this._extractParamName(param.left);
    } else if (t.isObjectPattern(param)) {
      return '{...}';
    } else if (t.isArrayPattern(param)) {
      return '[...]';
    }
    return '<unknown>';
  }

  /**
   * Helper: Extract method name from key
   * @private
   */
  _extractMethodName(key) {
    if (t.isIdentifier(key)) {
      return key.name;
    } else if (t.isStringLiteral(key)) {
      return key.value;
    } else if (t.isNumericLiteral(key)) {
      return String(key.value);
    } else if (t.isPrivateName(key)) {
      return `#${key.id.name}`;
    }
    return '<computed>';
  }

  /**
   * Helper: Extract property name from key
   * @private
   */
  _extractPropertyName(key) {
    if (t.isIdentifier(key)) {
      return key.name;
    } else if (t.isStringLiteral(key)) {
      return key.value;
    } else if (t.isNumericLiteral(key)) {
      return String(key.value);
    } else if (t.isPrivateName(key)) {
      return `#${key.id.name}`;
    }
    return '<computed>';
  }
}

module.exports = CodeParser;
