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
// https://sonarsource.github.io/rspec/#/rspec/S2999/javascript

import { Rule } from 'eslint';
import * as estree from 'estree';
import * as ts from 'typescript';
import {
  isRequiredParserServices,
  getTypeFromTreeNode,
  getSignatureFromCallee,
  toEncodedMessage,
} from './helpers';
import { SONAR_RUNTIME } from 'linting/eslint/linter/parameters';

export const rule: Rule.RuleModule = {
  meta: {
    schema: [
      { type: 'object' },
      {
        // internal parameter for rules having secondary locations
        enum: [SONAR_RUNTIME],
      },
    ],
  },
  create(context: Rule.RuleContext) {
    const { considerJSDoc } = context.options[0];
    const services = context.parserServices;
    if (!isRequiredParserServices(services)) {
      return {};
    }
    return {
      'NewExpression[callee.type!="ThisExpression"]': (node: estree.Node) => {
        const { callee } = node as estree.NewExpression;
        const type = getTypeFromTreeNode(callee, services);
        const signature = getSignatureFromCallee(node, services);
        if (!isInstantiable(type, signature, considerJSDoc) && !isAny(type)) {
          const functionToken = context
            .getSourceCode()
            .getFirstToken(node, token => token.type === 'Keyword' && token.value === 'function');
          const newToken = context
            .getSourceCode()
            .getFirstToken(node, token => token.type === 'Keyword' && token.value === 'new')!;
          const text = isFunction(type) ? 'this function' : context.getSourceCode().getText(callee);
          const loc = callee.type === 'FunctionExpression' ? functionToken!.loc : callee.loc!;
          context.report({
            message: toEncodedMessage(`Replace ${text} with a constructor function.`, [newToken]),
            loc,
          });
        }
      },
    };
  },
};

function isInstantiable(
  type: ts.Type,
  signature: ts.Signature | undefined,
  considerJSDoc: boolean,
): boolean {
  return (
    isClass(type) ||
    isModule(type) ||
    isConstructor(type, signature, considerJSDoc) ||
    (type.isUnionOrIntersection() &&
      type.types.some(tp => isInstantiable(tp, signature, considerJSDoc)))
  );
}

function isClass(type: ts.Type) {
  return (
    type.symbol &&
    ((type.symbol.flags & ts.SymbolFlags.Class) !== 0 ||
      (type.symbol.flags & ts.SymbolFlags.Type) !== 0)
  );
}

function isModule(type: ts.Type) {
  return type.symbol && (type.symbol.flags & ts.SymbolFlags.Module) !== 0;
}

function isFunction(type: ts.Type) {
  return type.symbol && (type.symbol.flags & ts.SymbolFlags.Function) !== 0;
}

function isConstructor(type: ts.Type, signature: ts.Signature | undefined, considerJSDoc: boolean) {
  return isFunction(type) && (!considerJSDoc || hasJSDocAnnotation(signature));
}

function hasJSDocAnnotation(signature: ts.Signature | undefined) {
  return (
    signature !== undefined &&
    signature.getJsDocTags().some(tag => ['constructor', 'class'].includes(tag.name))
  );
}

function isAny(type: ts.Type) {
  return type.flags === ts.TypeFlags.Any;
}
