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
// https://sonarsource.github.io/rspec/#/rspec/S1515/javascript

import { AST, Rule, Scope } from 'eslint';
import * as estree from 'estree';
import { getMainFunctionTokenLocation } from 'eslint-plugin-sonarjs/lib/utils/locations';
import { TSESTree } from '@typescript-eslint/experimental-utils';
import {
  findFirstMatchingAncestor,
  getParent,
  LoopLike,
  RuleContext,
  toEncodedMessage,
} from './helpers';
import { SONAR_RUNTIME } from 'linting/eslint/linter/parameters';

const message = 'Make sure this function is not called after the loop completes.';

const loopLike = 'WhileStatement,DoWhileStatement,ForStatement,ForOfStatement,ForInStatement';

const functionLike = 'FunctionDeclaration,FunctionExpression,ArrowFunctionExpression';

const allowedCallbacks = [
  'replace',
  'forEach',
  'filter',
  'map',
  'find',
  'findIndex',
  'every',
  'some',
  'reduce',
  'reduceRight',
  'sort',
  'each',
];

export const rule: Rule.RuleModule = {
  meta: {
    schema: [
      {
        // internal parameter for rules having secondary locations
        enum: [SONAR_RUNTIME],
      },
    ],
  },
  create(context: Rule.RuleContext) {
    function getLocalEnclosingLoop(node: estree.Node) {
      return findFirstMatchingAncestor(node as TSESTree.Node, n => loopLike.includes(n.type));
    }

    return {
      [functionLike]: (node: estree.Node) => {
        const loopNode = getLocalEnclosingLoop(node) as LoopLike;
        if (loopNode) {
          if (
            !isIIEF(node, context) &&
            !isAllowedCallbacks(context) &&
            context.getScope().through.some(ref => !isSafe(ref, loopNode))
          ) {
            context.report({
              message: toEncodedMessage(message, [getMainLoopToken(loopNode, context)]),
              loc: getMainFunctionTokenLocation(
                node as TSESTree.FunctionLike,
                getParent(context) as TSESTree.Node,
                context as unknown as RuleContext,
              ),
            });
          }
        }
      },
    };
  },
};

function isIIEF(node: estree.Node, context: Rule.RuleContext) {
  const parent = getParent(context);
  return (
    parent &&
    ((parent.type === 'CallExpression' && parent.callee === node) ||
      (parent.type === 'MemberExpression' && parent.object === node))
  );
}

function isAllowedCallbacks(context: Rule.RuleContext) {
  const parent = getParent(context);
  if (parent && parent.type === 'CallExpression') {
    const callee = parent.callee;
    if (callee.type === 'MemberExpression') {
      return (
        callee.property.type === 'Identifier' && allowedCallbacks.includes(callee.property.name)
      );
    }
  }
  return false;
}

function isSafe(ref: Scope.Reference, loopNode: LoopLike) {
  const variable = ref.resolved;
  if (variable) {
    const definition = variable.defs[0];
    const declaration = definition && definition.parent;
    const kind = declaration && declaration.type === 'VariableDeclaration' ? declaration.kind : '';

    if (kind !== 'let' && kind !== 'const') {
      return hasConstValue(variable, loopNode);
    }
  }

  return true;
}

function hasConstValue(variable: Scope.Variable, loopNode: LoopLike): boolean {
  for (const ref of variable.references) {
    if (ref.isWrite()) {
      //Check if write is in the scope of the loop
      if (ref.from.type === 'block' && ref.from.block === loopNode.body) {
        return false;
      }

      const refRange = ref.identifier.range;
      const range = getLoopTestRange(loopNode);
      //Check if value change in the header of the loop
      if (refRange && range && refRange[0] >= range[0] && refRange[1] <= range[1]) {
        return false;
      }
    }
  }
  return true;
}

function getLoopTestRange(loopNode: LoopLike) {
  const bodyRange = loopNode.body.range;
  if (bodyRange) {
    switch (loopNode.type) {
      case 'ForStatement':
        if (loopNode.test && loopNode.test.range) {
          return [loopNode.test.range[0], bodyRange[0]];
        }
        break;
      case 'WhileStatement':
      case 'DoWhileStatement':
        return loopNode.test.range;
      case 'ForOfStatement':
      case 'ForInStatement':
        const leftRange = loopNode.range;
        if (leftRange) {
          return [leftRange[0], bodyRange[0]];
        }
    }
  }
}

function getMainLoopToken(loop: LoopLike, context: Rule.RuleContext): AST.Token {
  const sourceCode = context.getSourceCode();
  let token: AST.Token | null;
  switch (loop.type) {
    case 'WhileStatement':
    case 'DoWhileStatement':
      token = sourceCode.getTokenBefore(
        loop.test,
        t => t.type === 'Keyword' && t.value === 'while',
      );
      break;
    case 'ForStatement':
    case 'ForOfStatement':
    default:
      token = sourceCode.getFirstToken(loop, t => t.type === 'Keyword' && t.value === 'for');
  }
  return token!;
}
