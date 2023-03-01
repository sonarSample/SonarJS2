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
import { rule } from 'linting/eslint/rules/chai-determinate-assertion';

// Main test cases are in the file chai-determinate-assertion.js (comment-based)
// Here we are testing that no issues are reported when no 'chai' import

const ruleTester = new RuleTester({ parserOptions: { ecmaVersion: 2018, sourceType: 'module' } });
ruleTester.run('Assertions should not be given twice the same argument', rule, {
  valid: [
    {
      code: `expect(foo).to.not.throw(ReferenceError);`,
    },
  ],
  invalid: [
    {
      code: `
      const chai = require('chai');
      expect(foo).to.not.throw(ReferenceError);`,
      errors: [{ line: 3 }],
    },
  ],
});
