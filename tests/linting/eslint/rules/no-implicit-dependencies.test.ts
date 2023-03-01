/*
 * SonarQube JavaScript Plugin
 * Copyright (C) 2011-2023 SonarSource SA
 * mailto:info AT sonarsource DOT com
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */
import { RuleTester } from 'eslint';
import { rule } from 'linting/eslint/rules/no-implicit-dependencies';
import path from 'path';

const filename = path.join(
  __dirname,
  'fixtures/no-implicit-dependencies/package-json-project/file.js',
);
const options = [];
const tsParserPath = require.resolve('@typescript-eslint/parser');
const ruleTester = new RuleTester({
  parser: tsParserPath,
  parserOptions: { ecmaVersion: 2018, sourceType: 'module' },
});

ruleTester.run('Dependencies should be explicit', rule, {
  valid: [
    {
      code: `import * as fs from "fs";`,
      filename,
      options,
    },
    {
      code: `import * as ts from "devDependency";`,
      filename,
      options,
    },
    {
      code: `import "peerDependency";`,
      filename,
      options,
    },
    {
      code: `import "dependency";`,
      filename,
      options,
    },
    {
      code: `import "@namespaced/dependency";`,
      filename,
      options,
    },
    {
      code: `import "typed-dependency";`,
      filename,
      options,
    },
    {
      code: `import "whitelist";`,
      filename,
      options: ['whitelist'],
    },
    {
      code: `import "@whitelist/dependency";`,
      filename,
      options: ['@whitelist/dependency'],
    },
    {
      code: `import "./relative";`,
      filename,
      options,
    },
    {
      code: `const fs = require("fs");`,
      filename,
      options,
    },
    {
      code: `const foo = require("foo", "bar");`,
      filename,
      options,
    },
    {
      code: `import "dependency";`,
      filename: path.join(
        __dirname,
        'fixtures/no-implicit-dependencies/bom-package-json-project/file.js',
      ),
      options,
    },
    {
      code: `const fs = require("node:fs/promises");`,
      filename,
      options,
    },
    {
      code: `import fs from 'node:fs/promises';`,
      filename,
      options,
    },
    {
      code: `import 'data:text/javascript,console.log("hello, world!");';`,
      filename,
      options,
    },
    {
      code: `import 'file:/some/file.js'`,
      filename,
      options,
    },
  ],
  invalid: [
    {
      code: `import "foo";`,
      filename,
      options,
      errors: [
        {
          message: 'Either remove this import or add it as a dependency.',
          line: 1,
          endLine: 1,
          column: 1,
          endColumn: 7,
        },
      ],
    },
    {
      code: `let foo = require("foo");`,
      filename,
      options,
      errors: [
        {
          message: 'Either remove this import or add it as a dependency.',
          line: 1,
          endLine: 1,
          column: 11,
          endColumn: 18,
        },
      ],
    },
    {
      code: `import "foo/bar";`,
      filename,
      options,
      errors: 1,
    },
    {
      code: `import "foo";`,
      filename: path.join(
        __dirname,
        'fixtures/no-implicit-dependencies/empty-package-json-project/file.js',
      ),
      options,
      errors: 1,
    },
    {
      code: `import "foo";`,
      filename: path.join(
        __dirname,
        'fixtures/no-implicit-dependencies/package-json-project/dir/subdir/file.js',
      ),
      options,
      errors: 1,
    },
    {
      code: `import "foo";`,
      filename: '/',
      options,
      errors: 1,
    },
  ],
});

const ruleTesterNestedPackage = new RuleTester({
  parser: tsParserPath,
  parserOptions: { ecmaVersion: 2018, sourceType: 'module' },
});

const filenameNestedPackage = path.join(
  __dirname,
  'fixtures/no-implicit-dependencies/nested-package-json-project/dir/file.js',
);

ruleTesterNestedPackage.run('all levels of package.json should be considered', rule, {
  valid: [
    {
      code: `
        import { f as f1 } from 'top-dependency';
        import { f as f2 } from 'nested-dependency';
      `,
      filename: filenameNestedPackage,
    },
  ],
  invalid: [
    {
      code: `
        import { f as f1 } from 'nonexistent';
      `,
      filename: filenameNestedPackage,
      errors: 1,
    },
  ],
});

const ruleTesterForPathMappings = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    tsconfigRootDir: path.join(
      __dirname,
      'fixtures/no-implicit-dependencies/ts-project-with-path-aliases',
    ),
    project: './tsconfig.json',
  },
});

const filenameForFileWithPathMappings = path.join(
  __dirname,
  'fixtures/no-implicit-dependencies/ts-project-with-path-aliases/file.ts',
);

ruleTesterForPathMappings.run('Path aliases should be exempt', rule, {
  valid: [
    {
      code: `
        import { f as f1 } from '$b/c/d.e';
        import { f as f2 } from '@b/c/d.e';
        import { f as f3 } from 'b/c/d.e';
        import { f as f4 } from 'foo/bar/c/d.e';
        import { f as f5 } from 'concrete';
        let f6 = require("foo/bar/c/d.e").f;
        import { f as f7 } from 'p/refixc/d.esuffi/x';
        import { f as f8 } from 'yoda/c/d.e/path';
        import { f as f9 } from 'dependency-in-package-json';
      `,
      filename: filenameForFileWithPathMappings,
    },
  ],
  invalid: [
    {
      code: `
        import { f as f1 } from '$invalid/c/d.e';
        import { f as f2 } from '@invalid/c/d.e';
        import { f as f3 } from 'invalid/c/d.e';
        import { f as f4 } from 'nonexistent';
        import "foo";
        import "foo/baz/something";
        require("this/doesnt/exist").f;
        import { f as f8 } from 'p/refixc/d.e/suffi/x2';
        import { f as f9 } from 'yoda/c/d.e/paths';
        import { f as fA } from 'dependency-not-in-package-json';
      `,
      filename: filenameForFileWithPathMappings,
      errors: 10,
    },
  ],
});

const ruleTesterForBaseUrl = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    tsconfigRootDir: path.join(
      __dirname,
      'fixtures/no-implicit-dependencies/ts-project-with-base-url',
    ),
    project: './tsconfig.json',
  },
});

const filenameForBaseUrl = path.join(
  __dirname,
  'fixtures/no-implicit-dependencies/ts-project-with-base-url/nested/file.ts',
);

ruleTesterForBaseUrl.run('Imports based on baseUrl should be accepted', rule, {
  valid: [
    {
      code: `
        import { f as f1 } from 'dependency-in-package-json';
        import { f as f2 } from 'dir';
        import { f as f3 } from 'a';
        import { f as f3 } from 'c';
        import { f as f4 } from 'dir/b';
      `,
      filename: filenameForBaseUrl,
    },
  ],
  invalid: [
    {
      code: `
        import { f as f1 } from 'nonexistent';
        import { f as f1 } from 'dir/nonexistent';
      `,
      filename: filenameForBaseUrl,
      errors: 2,
    },
  ],
});

const ruleTesterForCatchAllExample = new RuleTester({
  parser: tsParserPath,
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    tsconfigRootDir: path.join(
      __dirname,
      'fixtures/no-implicit-dependencies/ts-project-with-catch-all-path-alias',
    ),
    project: './tsconfig.json',
  },
});

const filenameCatchAllExample = path.join(
  __dirname,
  'fixtures/no-implicit-dependencies/ts-project-with-catch-all-path-alias/file.ts',
);

ruleTesterForCatchAllExample.run(
  'Do not report when a path mapping with "*"-pattern is used',
  rule,
  {
    valid: [
      {
        code: `
          import { f } from '$b/c/d.e';
          import { f } from 'concretegenerated';
          let f = require("this/might/be/generated").f;
        `,
        filename: filenameCatchAllExample,
      },
    ],
    invalid: [],
  },
);
