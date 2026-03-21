import CodeParser from '../../../src/parser/CodeParser.js';
import path from 'path';
import fs from 'fs-extra';

describe('CodeParser', () => {
  let parser;

  beforeEach(() => {
    parser = new CodeParser();
  });

  describe('parseFile', () => {
    it('should parse valid JavaScript code successfully', async () => {
      const code = `
        function hello() {
          return 'world';
        }
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.filePath).toBe('test.js');
      expect(result.ast).not.toBeNull();
      expect(result.errors).toHaveLength(0);
      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe('hello');
    });

    it('should handle syntax errors gracefully', async () => {
      const code = `
        function broken() {
          return 'missing closing brace'
      `;
      const result = await parser.parseFile('broken.js', code);

      expect(result.filePath).toBe('broken.js');
      expect(result.ast).toBeNull();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBeDefined();
      expect(result.errors[0].line).toBeGreaterThan(0);
    });

    it('should parse TypeScript code with type annotations', async () => {
      const code = `
        function greet(name: string): string {
          return \`Hello, \${name}\`;
        }
      `;
      const result = await parser.parseFile('test.ts', code);

      expect(result.ast).not.toBeNull();
      expect(result.errors).toHaveLength(0);
      expect(result.functions).toHaveLength(1);
    });

    it('should parse JSX code', async () => {
      const code = `
        function Component() {
          return <div>Hello</div>;
        }
      `;
      const result = await parser.parseFile('test.jsx', code);

      expect(result.ast).not.toBeNull();
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('extractFunctions', () => {
    it('should extract regular function declarations', async () => {
      const code = `
        function regularFunc(a, b) {
          return a + b;
        }
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0]).toMatchObject({
        name: 'regularFunc',
        type: 'function',
        params: ['a', 'b'],
        async: false,
        generator: false
      });
      expect(result.functions[0].location.start.line).toBeGreaterThan(0);
    });

    it('should extract arrow functions', async () => {
      const code = `
        const arrowFunc = (x, y) => x + y;
        const asyncArrow = async (data) => await process(data);
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.functions).toHaveLength(2);
      expect(result.functions[0]).toMatchObject({
        name: 'arrowFunc',
        type: 'arrow',
        params: ['x', 'y'],
        async: false
      });
      expect(result.functions[1]).toMatchObject({
        name: 'asyncArrow',
        type: 'arrow',
        params: ['data'],
        async: true
      });
    });

    it('should extract class methods', async () => {
      const code = `
        class MyClass {
          constructor(name) {
            this.name = name;
          }
          
          greet() {
            return 'Hello';
          }
          
          static create() {
            return new MyClass('default');
          }
          
          async fetchData() {
            return await fetch('/api');
          }
        }
      `;
      const result = await parser.parseFile('test.js', code);

      const methods = result.functions.filter(f => f.type === 'method');
      expect(methods).toHaveLength(4);
      
      const constructor = methods.find(m => m.name === 'constructor');
      expect(constructor).toBeDefined();
      expect(constructor.kind).toBe('constructor');
      
      const staticMethod = methods.find(m => m.name === 'create');
      expect(staticMethod.static).toBe(true);
      
      const asyncMethod = methods.find(m => m.name === 'fetchData');
      expect(asyncMethod.async).toBe(true);
    });

    it('should extract generator functions', async () => {
      const code = `
        function* generatorFunc() {
          yield 1;
          yield 2;
        }
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].generator).toBe(true);
    });

    it('should extract object methods', async () => {
      const code = `
        const obj = {
          method1() {
            return 'hello';
          },
          async method2() {
            return await fetch();
          }
        };
      `;
      const result = await parser.parseFile('test.js', code);

      const methods = result.functions.filter(f => f.type === 'method');
      expect(methods).toHaveLength(2);
      expect(methods[0].name).toBe('method1');
      expect(methods[1].name).toBe('method2');
      expect(methods[1].async).toBe(true);
    });

    it('should handle various parameter types', async () => {
      const code = `
        function withRest(...args) {}
        function withDefault(a = 5) {}
        function withDestructure({ x, y }) {}
        function withArrayDestructure([a, b]) {}
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.functions).toHaveLength(4);
      expect(result.functions[0].params).toEqual(['...args']);
      expect(result.functions[1].params).toEqual(['a']);
      expect(result.functions[2].params).toEqual(['{...}']);
      expect(result.functions[3].params).toEqual(['[...]']);
    });
  });

  describe('extractClasses', () => {
    it('should extract class declarations', async () => {
      const code = `
        class Animal {
          constructor(name) {
            this.name = name;
          }
          
          speak() {
            console.log('Sound');
          }
        }
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]).toMatchObject({
        name: 'Animal',
        superClass: null
      });
      expect(result.classes[0].methods).toHaveLength(2);
      expect(result.classes[0].location.start.line).toBeGreaterThan(0);
    });

    it('should extract class with inheritance', async () => {
      const code = `
        class Dog extends Animal {
          bark() {
            console.log('Woof');
          }
        }
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].name).toBe('Dog');
      expect(result.classes[0].superClass).toBe('Animal');
    });

    it('should extract class properties', async () => {
      const code = `
        class MyClass {
          publicProp = 'value';
          static staticProp = 42;
          
          method() {}
        }
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].properties).toHaveLength(2);
      expect(result.classes[0].properties[0].name).toBe('publicProp');
      expect(result.classes[0].properties[1].name).toBe('staticProp');
      expect(result.classes[0].properties[1].static).toBe(true);
    });

    it('should extract class expressions', async () => {
      const code = `
        const MyClass = class {
          constructor() {}
        };
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].name).toBe('MyClass');
    });

    it('should extract getters and setters', async () => {
      const code = `
        class MyClass {
          get value() {
            return this._value;
          }
          
          set value(v) {
            this._value = v;
          }
        }
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].methods).toHaveLength(2);
      expect(result.classes[0].methods[0].kind).toBe('get');
      expect(result.classes[0].methods[1].kind).toBe('set');
    });
  });

  describe('extractImportsExports', () => {
    it('should extract default imports', async () => {
      const code = `
        import React from 'react';
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0]).toMatchObject({
        source: 'react',
        specifiers: [{
          type: 'default',
          local: 'React',
          imported: 'default'
        }]
      });
    });

    it('should extract named imports', async () => {
      const code = `
        import { useState, useEffect } from 'react';
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].specifiers).toHaveLength(2);
      expect(result.imports[0].specifiers[0]).toMatchObject({
        type: 'named',
        local: 'useState',
        imported: 'useState'
      });
    });

    it('should extract namespace imports', async () => {
      const code = `
        import * as Utils from './utils';
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].specifiers[0]).toMatchObject({
        type: 'namespace',
        local: 'Utils',
        imported: '*'
      });
    });

    it('should extract named exports', async () => {
      const code = `
        export const foo = 1;
        export function bar() {}
        export class Baz {}
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.exports).toHaveLength(3);
      expect(result.exports[0]).toMatchObject({
        name: 'foo',
        type: 'named'
      });
      expect(result.exports[1]).toMatchObject({
        name: 'bar',
        type: 'named'
      });
      expect(result.exports[2]).toMatchObject({
        name: 'Baz',
        type: 'named'
      });
    });

    it('should extract default exports', async () => {
      const code = `
        export default function myFunc() {}
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        name: 'myFunc',
        type: 'default'
      });
    });

    it('should extract export all', async () => {
      const code = `
        export * from './module';
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        name: '*',
        type: 'all',
        source: './module'
      });
    });

    it('should extract re-exports', async () => {
      const code = `
        export { foo, bar } from './other';
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.exports).toHaveLength(2);
      expect(result.exports[0].name).toBe('foo');
      expect(result.exports[1].name).toBe('bar');
    });
  });

  describe('extractComments', () => {
    it('should extract line comments', async () => {
      const code = `
        // This is a line comment
        function foo() {}
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0]).toMatchObject({
        type: 'line',
        value: 'This is a line comment'
      });
      expect(result.comments[0].location.start.line).toBeGreaterThan(0);
    });

    it('should extract block comments', async () => {
      const code = `
        /* This is a
           block comment */
        function foo() {}
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].type).toBe('block');
      expect(result.comments[0].value).toContain('This is a');
    });

    it('should extract TODO markers in comments', async () => {
      const code = `
        // TODO: Implement this feature
        function incomplete() {}
        
        /* FIXME: This needs fixing */
        function broken() {}
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.comments).toHaveLength(2);
      expect(result.comments[0].value).toContain('TODO');
      expect(result.comments[1].value).toContain('FIXME');
    });

    it('should extract JSDoc comments', async () => {
      const code = `
        /**
         * This is a JSDoc comment
         * @param {string} name - The name
         * @returns {string} The greeting
         */
        function greet(name) {
          return 'Hello ' + name;
        }
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].type).toBe('block');
      expect(result.comments[0].value).toContain('@param');
      expect(result.comments[0].value).toContain('@returns');
    });
  });

  describe('edge cases', () => {
    it('should handle empty files', async () => {
      const code = '';
      const result = await parser.parseFile('empty.js', code);

      expect(result.ast).not.toBeNull();
      expect(result.functions).toHaveLength(0);
      expect(result.classes).toHaveLength(0);
      expect(result.imports).toHaveLength(0);
      expect(result.exports).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle files with only comments', async () => {
      const code = `
        // Just a comment
        /* Another comment */
      `;
      const result = await parser.parseFile('comments.js', code);

      expect(result.ast).not.toBeNull();
      expect(result.comments).toHaveLength(2);
      expect(result.functions).toHaveLength(0);
    });

    it('should handle anonymous functions', async () => {
      const code = `
        const fn = function() {};
        export default function() {};
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.functions).toHaveLength(2);
      expect(result.functions[0].name).toBe('fn');
    });

    it('should handle computed property names', async () => {
      const code = `
        const key = 'method';
        class MyClass {
          [key]() {}
        }
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].methods).toHaveLength(1);
      expect(result.classes[0].methods[0].name).toBe('<computed>');
    });

    it('should handle private class members', async () => {
      const code = `
        class MyClass {
          #privateMethod() {}
          #privateField = 42;
        }
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].methods[0].name).toBe('#privateMethod');
      expect(result.classes[0].properties[0].name).toBe('#privateField');
    });

    it('should handle async generators', async () => {
      const code = `
        async function* asyncGen() {
          yield await Promise.resolve(1);
        }
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].async).toBe(true);
      expect(result.functions[0].generator).toBe(true);
    });

    it('should preserve location information for all elements', async () => {
      const code = `
        function test() {
          return 42;
        }
      `;
      const result = await parser.parseFile('test.js', code);

      expect(result.functions[0].location).toBeDefined();
      expect(result.functions[0].location.start).toBeDefined();
      expect(result.functions[0].location.end).toBeDefined();
      expect(result.functions[0].location.start.line).toBeGreaterThan(0);
      expect(result.functions[0].location.start.column).toBeGreaterThanOrEqual(0);
    });
  });
});
