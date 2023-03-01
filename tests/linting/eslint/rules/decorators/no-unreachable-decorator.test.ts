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
import { eslintRules } from 'linting/eslint/rules/core';
import { decorateNoUnreachable } from 'linting/eslint/rules/decorators/no-unreachable-decorator';

const ruleTester = new RuleTester();
const rule = decorateNoUnreachable(eslintRules['no-unreachable']);

ruleTester.run(`Decorated rule should provide suggestion`, rule, {
  valid: [
    {
      code: `
while (a()) {
  b();
  break;
}
`,
    },
  ],
  invalid: [
    {
      code: `
while (a()) {
  break;
  b();
}
`,
      errors: [
        {
          suggestions: [
            {
              output: `
while (a()) {
  break;
}
`,
              desc: 'Remove unreachable code',
            },
          ],
        },
      ],
    },
    {
      code: `
while (a()) {
  b();
  break;
  c();
  d();
}
`,
      errors: [
        {
          suggestions: [
            {
              output: `
while (a()) {
  b();
  break;
}
`,
              desc: 'Remove unreachable code',
            },
          ],
        },
      ],
    },
  ],
});
