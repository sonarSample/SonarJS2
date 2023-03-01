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
import { rule } from 'linting/eslint/rules/sonar-no-control-regex';

const ruleTester = new RuleTester({ parserOptions: { ecmaVersion: 2018, sourceType: 'module' } });
ruleTester.run('No control characters in regular expressions', rule, {
  valid: [
    {
      code: `/0/`,
    },
    {
      code: `/\\0/`,
    },
    {
      code: `/\\x20/`,
    },
    {
      code: `/\\u0020/`,
    },
    {
      code: `/\\u{001F}/`,
    },
    {
      code: `/\\cA/`,
    },
  ],
  invalid: [
    {
      code: `/\\x00/`,
      errors: [
        {
          message: 'Remove this control character: \\x00.',
          line: 1,
          endLine: 1,
          column: 2,
          endColumn: 6,
        },
      ],
    },
    {
      code: `/\\u001F/`,
      errors: [
        {
          message: 'Remove this control character: \\u001F.',
          line: 1,
          endLine: 1,
          column: 2,
          endColumn: 8,
        },
      ],
    },
    {
      code: `/\\u{001F}/u`,
      errors: [
        {
          message: 'Remove this control character: \\u{001F}.',
          line: 1,
          endLine: 1,
          column: 2,
          endColumn: 10,
        },
      ],
    },
  ],
});
