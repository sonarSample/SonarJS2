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
// https://sonarsource.github.io/rspec/#/rspec/S2692/javascript

import { Rule } from 'eslint';
import * as estree from 'estree';
import { isArray, isRequiredParserServices, RequiredParserServices } from './helpers';

export const rule: Rule.RuleModule = {
  meta: {
    messages: {
      considerIncludes:
        "This check ignores index 0; consider using 'includes' method to make this check safe and explicit.",
    },
  },
  create(context: Rule.RuleContext) {
    const services = context.parserServices;
    if (!isRequiredParserServices(services)) {
      return {};
    }
    return {
      BinaryExpression(node: estree.Node) {
        const expression = node as estree.BinaryExpression;
        if (
          expression.operator === '>' &&
          isZero(expression.right) &&
          isArrayIndexOfCall(expression.left, services)
        ) {
          context.report({ node, messageId: 'considerIncludes' });
        }
      },
    };
  },
};

function isZero(node: estree.Expression): boolean {
  return node.type === 'Literal' && node.value === 0;
}

function isArrayIndexOfCall(node: estree.Expression, services: RequiredParserServices): boolean {
  return (
    node.type === 'CallExpression' &&
    node.arguments.length === 1 &&
    node.callee.type === 'MemberExpression' &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'indexOf' &&
    isArray(node.callee.object, services)
  );
}
