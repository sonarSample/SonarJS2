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
import { Rule } from 'eslint';
import {
  getFullyQualifiedName,
  getImportDeclarations,
  getObjectExpressionProperty,
  getUniqueWriteUsage,
  isIdentifier,
} from 'linting/eslint/rules/helpers';

/**
 *
 */
export const ruleId = 'no-missing-sonar-runtime';

/**
 * This rule is applied to our own code in the `src/rules` directory.
 * It checks whether the `sonar-runtime` is set for rules that obviously use the
 * `toEncodedMessage` method (which encodes secondary locations).
 */
export const rule: Rule.RuleModule = {
  create(context: Rule.RuleContext) {
    let isSecondaryLocationUsed = false;
    let isSecondaryLocationEnabled = false;
    return {
      CallExpression: (node: estree.Node) => {
        if (isSecondaryLocationUsed) {
          return;
        }
        const { callee } = node as estree.CallExpression;
        if (callee.type === 'Identifier' && callee.name === 'toEncodedMessage') {
          isSecondaryLocationUsed =
            getModuleNameOfImportedIdentifier(context, callee) === './helpers';
        }
      },
      ObjectExpression: (node: estree.Node) => {
        if (isSecondaryLocationEnabled) {
          return;
        }
        const maybeMeta = getObjectExpressionProperty(node, 'meta');
        if (maybeMeta) {
          const maybeSchema = getObjectExpressionProperty(maybeMeta.value, 'schema');
          if (maybeSchema && maybeSchema.value.type === 'ArrayExpression') {
            const schema = maybeSchema.value;
            for (const element of schema.elements) {
              const maybeEnum = getObjectExpressionProperty(element, 'enum');
              if (maybeEnum) {
                isSecondaryLocationEnabled =
                  maybeEnum.value.type === 'ArrayExpression' &&
                  maybeEnum.value.elements.length === 1 &&
                  maybeEnum.value.elements[0].type === 'Identifier' &&
                  maybeEnum.value.elements[0].name === 'SONAR_RUNTIME';
              }
            }
          }
        }
      },
      'Program:exit': (node: estree.Node) => {
        if (isSecondaryLocationUsed && !isSecondaryLocationEnabled) {
          context.report({
            message: `Missing enabling of secondary location support`,
            node,
          });
        }
      },
    };
  },
};

/**
 * Returns the module name, when an identifier represents a binding imported from another module.
 * Returns undefined otherwise.
 * example: Given `import { f } from 'module_name'`, `getModuleNameOfImportedIdentifier(f)` returns `module_name`
 */
function getModuleNameOfImportedIdentifier(
  context: Rule.RuleContext,
  identifier: estree.Identifier,
) {
  // check if importing using `import { f } from 'module_name'`
  const importedDeclaration = getImportDeclarations(context).find(({ specifiers }) =>
    specifiers.some(
      spec => spec.type === 'ImportSpecifier' && spec.imported.name === identifier.name,
    ),
  );
  if (importedDeclaration) {
    return importedDeclaration.source.value;
  }
  // check if importing using `const f = require('module_name').f` or `const { f } = require('module_name')`
  const writeExpression = getUniqueWriteUsage(context, identifier.name);
  if (writeExpression) {
    let maybeRequireCall: estree.Node;
    if (
      writeExpression.type === 'MemberExpression' &&
      isIdentifier(writeExpression.property, identifier.name)
    ) {
      maybeRequireCall = writeExpression.object;
    } else {
      maybeRequireCall = writeExpression;
    }
    const fqn = getFullyQualifiedName(context, maybeRequireCall);
    return fqn?.split('.')[0];
  }

  return undefined;
}
