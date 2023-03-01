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
// https://sonarsource.github.io/rspec/#/rspec/S1534/javascript

import { Rule, AST } from 'eslint';
import { interceptReport } from './helpers';
import * as estree from 'estree';

// core implementation of this rule does not provide quick fixes
export function decorateNoDupeKeys(rule: Rule.RuleModule): Rule.RuleModule {
  rule.meta!.hasSuggestions = true;
  return interceptReport(rule, (context, reportDescriptor) => {
    context.report({
      ...reportDescriptor,
      suggest: [
        {
          desc: 'Remove this duplicate property',
          fix(fixer) {
            const propertyToRemove = getPropertyNode(reportDescriptor, context)!;
            const commaAfter = context
              .getSourceCode()
              .getTokenAfter(propertyToRemove, token => token.value === ',');
            const commaBefore = context
              .getSourceCode()
              .getTokenBefore(propertyToRemove, token => token.value === ',')!;

            let start = commaBefore.range[1];
            let end = propertyToRemove.range![1];
            if (commaAfter) {
              end = commaAfter.range[1];
            } else {
              start = commaBefore.range[0];
            }
            return fixer.removeRange([start, end]);
          },
        },
      ],
    });
  });
}

function getPropertyNode(reportDescriptor: Rule.ReportDescriptor, context: Rule.RuleContext) {
  if ('node' in reportDescriptor && 'loc' in reportDescriptor) {
    const objectLiteral = reportDescriptor['node'] as estree.ObjectExpression;
    const loc = reportDescriptor['loc'] as AST.SourceLocation;

    const transformPosToIndex = (p: estree.Position) => context.getSourceCode().getIndexFromLoc(p);
    return objectLiteral.properties.find(
      property =>
        transformPosToIndex(property.loc?.start!) <= transformPosToIndex(loc?.start) &&
        transformPosToIndex(property.loc?.end!) >= transformPosToIndex(loc?.end),
    );
  } else {
    throw new Error('Missing properties in report descriptor for rule S1534');
  }
}
