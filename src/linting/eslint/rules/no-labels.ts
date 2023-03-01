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
// https://sonarsource.github.io/rspec/#/rspec/S1119/javascript

import { Rule } from 'eslint';

export const rule: Rule.RuleModule = {
  meta: {
    messages: {
      removeLabel: 'Refactor the code to remove this label and the need for it.',
    },
  },
  create(context: Rule.RuleContext) {
    return {
      LabeledStatement(node) {
        const sourceCode = context.getSourceCode();
        context.report({
          messageId: 'removeLabel',
          loc: sourceCode.getFirstToken(node)!.loc,
        });
      },
    };
  },
};
