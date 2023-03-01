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
import * as estree from 'estree';
import * as regexpp from 'regexpp';
import { Rule } from 'eslint';
import {
  getUniqueWriteUsage,
  isBinaryPlus,
  isIdentifier,
  isRegexLiteral,
  isStaticTemplateLiteral,
  isStringLiteral,
} from 'linting/eslint/rules/helpers';
import { TSESTree } from '@typescript-eslint/experimental-utils';
import { isRegExpConstructor } from './ast';
import { getFlags } from './flags';

export function getParsedRegex(
  node: estree.Node,
  context: Rule.RuleContext,
): regexpp.AST.RegExpLiteral | null {
  const patternAndFlags = getPatternFromNode(node, context);
  if (patternAndFlags) {
    try {
      return regexpp.parseRegExpLiteral(new RegExp(patternAndFlags.pattern, patternAndFlags.flags));
    } catch {
      // do nothing for invalid regex
    }
  }

  return null;
}

function getPatternFromNode(
  node: estree.Node,
  context: Rule.RuleContext,
): { pattern: string; flags: string } | null {
  if (isRegExpConstructor(node)) {
    const patternOnly = getPatternFromNode(node.arguments[0], context);
    const flags = getFlags(node);
    if (patternOnly && flags !== null) {
      return { pattern: patternOnly.pattern, flags };
    }
  } else if (isRegexLiteral(node)) {
    return node.regex;
  } else if (isStringLiteral(node)) {
    return { pattern: node.value as string, flags: '' };
  } else if (isStaticTemplateLiteral(node)) {
    return { pattern: node.quasis[0].value.raw, flags: '' };
  } else if (isIdentifier(node)) {
    const assignedExpression = getUniqueWriteUsage(context, node.name);
    if (
      assignedExpression &&
      (assignedExpression as TSESTree.Node).parent?.type === 'VariableDeclarator'
    ) {
      return getPatternFromNode(assignedExpression, context);
    }
  } else if (isBinaryPlus(node)) {
    const left = getPatternFromNode(node.left, context);
    const right = getPatternFromNode(node.right, context);
    if (left && right) {
      return { pattern: left.pattern + right.pattern, flags: '' };
    }
  }

  return null;
}
