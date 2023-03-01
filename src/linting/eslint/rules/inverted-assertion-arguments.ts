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
// https://sonarsource.github.io/rspec/#/rspec/S3415/javascript

import { Rule } from 'eslint';
import * as estree from 'estree';
import { isIdentifier, isLiteral, isMethodCall, Mocha, toEncodedMessage } from './helpers';
import { SONAR_RUNTIME } from 'linting/eslint/linter/parameters';

const ASSERT_FUNCTIONS = [
  'equal',
  'notEqual',
  'strictEqual',
  'notStrictEqual',
  'deepEqual',
  'notDeepEqual',
  'closeTo',
  'approximately',
];

export const rule: Rule.RuleModule = {
  meta: {
    hasSuggestions: true,
    schema: [
      {
        // internal parameter for rules having secondary locations
        enum: [SONAR_RUNTIME],
      },
    ],
  },
  create(context: Rule.RuleContext) {
    const testCases: estree.Node[] = [];
    return {
      CallExpression(node: estree.Node) {
        if (Mocha.isTestCase(node)) {
          testCases.push(node);
          return;
        }
        if (testCases.length > 0) {
          checkInvertedArguments(node as estree.CallExpression, context);
        }
      },
      'CallExpression:exit': (node: estree.Node) => {
        if (Mocha.isTestCase(node)) {
          testCases.pop();
        }
      },
    };
  },
};

function checkInvertedArguments(node: estree.CallExpression, context: Rule.RuleContext) {
  const args = extractAssertionsArguments(node);
  if (args) {
    const [actual, expected, format] = args;
    if (isLiteral(actual) && !isLiteral(expected)) {
      const message = toEncodedMessage(
        `Swap these 2 arguments so they are in the correct order: ${format}.`,
        [actual],
        ['Other argument to swap.'],
      );
      context.report({
        node: expected,
        message,
        suggest: [
          {
            desc: 'Swap arguments',
            fix: fixer => [
              fixer.replaceText(actual, context.getSourceCode().getText(expected)),
              fixer.replaceText(expected, context.getSourceCode().getText(actual)),
            ],
          },
        ],
      });
    }
  }
}

function extractAssertionsArguments(
  node: estree.CallExpression,
): [estree.Node, estree.Node, string] | null {
  return extractAssertArguments(node) ?? extractExpectArguments(node) ?? extractFailArguments(node);
}

function extractAssertArguments(
  node: estree.CallExpression,
): [estree.Node, estree.Node, string] | null {
  if (isMethodCall(node) && node.arguments.length > 1) {
    const {
      callee: { object, property },
      arguments: [actual, expected],
    } = node;
    if (isIdentifier(object, 'assert') && isIdentifier(property, ...ASSERT_FUNCTIONS)) {
      return [actual, expected, `${object.name}.${property.name}(actual, expected)`];
    }
  }
  return null;
}

function extractExpectArguments(
  node: estree.CallExpression,
): [estree.Node, estree.Node, string] | null {
  if (node.callee.type !== 'MemberExpression') {
    return null;
  }
  let { object, property } = node.callee;
  if (!isIdentifier(property, 'equal', 'eql', 'closeTo')) {
    return null;
  }
  while (object.type === 'MemberExpression') {
    object = object.object;
  }
  if (object.type === 'CallExpression' && isIdentifier(object.callee, 'expect')) {
    return [
      object.arguments[0],
      node.arguments[0],
      `${object.callee.name}(actual).to.${property.name}(expected)`,
    ];
  }
  return null;
}

function extractFailArguments(
  node: estree.CallExpression,
): [estree.Node, estree.Node, string] | null {
  if (isMethodCall(node) && node.arguments.length > 1) {
    const {
      callee: { object, property },
      arguments: [actual, expected],
    } = node;
    if (isIdentifier(object, 'assert', 'expect', 'should') && isIdentifier(property, 'fail')) {
      return [actual, expected, `${object.name}.${property.name}(actual, expected)`];
    }
  }
  return null;
}
