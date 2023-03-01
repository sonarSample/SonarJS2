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
import { TypeScriptRuleTester } from '../../../tools';
import { rule } from 'linting/eslint/rules/web-sql-database';

const ruleTesterJs = new RuleTester({ parserOptions: { ecmaVersion: 2018 } });
const ruleTesterTs = new TypeScriptRuleTester();

ruleTesterJs.run('No issues without types', rule, {
  valid: [
    {
      code: `
      var db2 = openDatabase("myDb", "1.0", "P", 2*1024*1024);
            `,
    },
    {
      code: `
      var db3 = this.openDatabase("myDb", "1.0", "P", 2*1024*1024, callback);
            `,
    },
    {
      code: `
      var win = window;
      win.openDatabase("db","1.0","stuff",2*1024*1024);
            `,
    },
  ],
  invalid: [],
});

ruleTesterTs.run('Web SQL databases should not be used', rule, {
  valid: [
    {
      code: `
      var deb = getDb();
      var db4 = db.openDatabase("myDb", "1.0", "P", 2*1024*1024);
            `,
    },
    {
      code: `
      function openDatabase() {
      }
      openDatabase();
            `,
    },
    {
      code: `
      var win = window;
      win.somethingElse(); // OK
            `,
    },
  ],
  invalid: [
    {
      code: `
      var win = window;
      win.openDatabase("db","1.0","stuff",2*1024*1024);
            `,
      errors: [
        {
          line: 3,
          column: 7,
          endLine: 3,
          endColumn: 23,
          message: 'Convert this use of a Web SQL database to another technology.',
        },
      ],
    },
    {
      code: `
      var db2 = openDatabase("myDb", "1.0", "P", 2*1024*1024);
            `,
      errors: 1,
    },
    {
      code: `
      var db2 = openDatabase("myDb", "1.0", "P", 2*1024*1024);
            `,
      errors: 1,
    },
    {
      code: `
      var db3 = this.openDatabase("myDb", "1.0", "P", 2*1024*1024, callback);
            `,
      errors: 1,
    },
  ],
});
