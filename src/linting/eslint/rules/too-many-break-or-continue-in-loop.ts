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
// https://sonarsource.github.io/rspec/#/rspec/S135/javascript

import { Rule } from 'eslint';
import * as estree from 'estree';
import { toEncodedMessage } from './helpers';
import { SONAR_RUNTIME } from 'linting/eslint/linter/parameters';

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
    let jumpTargets: JumpTarget[] = [];

    function enterScope() {
      jumpTargets.push(new JumpTarget());
    }

    function leaveScope() {
      jumpTargets.pop();
    }

    function increateNumberOfJumpsInScopes(jump: estree.Node, label?: string) {
      for (const jumpTarget of [...jumpTargets].reverse()) {
        jumpTarget.jumps.push(jump);
        if (label === jumpTarget.label) {
          break;
        }
      }
    }

    function leaveScopeAndCheckNumberOfJumps(node: estree.Node) {
      const jumps = jumpTargets.pop()?.jumps;
      if (jumps && jumps.length > 1) {
        const sourceCode = context.getSourceCode();
        const firstToken = sourceCode.getFirstToken(node);
        context.report({
          loc: firstToken!.loc,
          message: toEncodedMessage(
            'Reduce the total number of "break" and "continue" statements in this loop to use one at most.',
            jumps,
            jumps.map(jmp =>
              jmp.type === 'BreakStatement' ? '"break" statement.' : '"continue" statement.',
            ),
          ),
        });
      }
    }

    return {
      Program: () => {
        jumpTargets = [];
      },
      BreakStatement: (node: estree.Node) => {
        const breakStatement = node as estree.BreakStatement;
        increateNumberOfJumpsInScopes(breakStatement, breakStatement.label?.name);
      },
      ContinueStatement: (node: estree.Node) => {
        const continueStatement = node as estree.ContinueStatement;
        increateNumberOfJumpsInScopes(continueStatement, continueStatement.label?.name);
      },
      SwitchStatement: enterScope,
      'SwitchStatement:exit': leaveScope,
      ForStatement: enterScope,
      'ForStatement:exit': leaveScopeAndCheckNumberOfJumps,
      ForInStatement: enterScope,
      'ForInStatement:exit': leaveScopeAndCheckNumberOfJumps,
      ForOfStatement: enterScope,
      'ForOfStatement:exit': leaveScopeAndCheckNumberOfJumps,
      WhileStatement: enterScope,
      'WhileStatement:exit': leaveScopeAndCheckNumberOfJumps,
      DoWhileStatement: enterScope,
      'DoWhileStatement:exit': leaveScopeAndCheckNumberOfJumps,
      LabeledStatement: (node: estree.Node) => {
        const labeledStatement = node as estree.LabeledStatement;
        jumpTargets.push(new JumpTarget(labeledStatement.label.name));
      },
      'LabeledStatement:exit': leaveScope,
    };
  },
};

class JumpTarget {
  label?: string;
  jumps: estree.Node[] = [];

  constructor(label?: string) {
    this.label = label;
  }
}
