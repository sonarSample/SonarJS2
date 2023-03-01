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
import { TSESTree } from '@typescript-eslint/experimental-utils';
import { SourceCode, AST } from 'eslint';
import { visit } from './visitor';
import { Location } from './metrics/helpers';

/**
 * A copy-paste detector token (cpd)
 *
 * A cpd token is used by SonarQube to compute code duplication
 * within a code base. It relies on a token location as well as
 * an image, that is, the token value except for string literal
 * which is anonymised to extend the scope of what a duplicated
 * code pattern can be.
 *
 * @param location the token location
 * @param image the token
 */
export interface CpdToken {
  location: Location;
  image: string;
}

/**
 * Extracts the copy-paste detector (cpd) tokens
 * @param sourceCode the source code to extract from
 * @returns the cpd tokens
 */
export function getCpdTokens(sourceCode: SourceCode): { cpdTokens: CpdToken[] } {
  const cpdTokens: CpdToken[] = [];
  const tokens = sourceCode.ast.tokens;
  const { jsxTokens, importTokens, requireTokens } = extractTokens(sourceCode);

  tokens.forEach(token => {
    let text = token.value;

    if (text.trim().length === 0) {
      // for EndOfFileToken and JsxText tokens containing only whitespaces
      return;
    }

    if (importTokens.includes(token)) {
      // for tokens from import statements
      return;
    }

    if (requireTokens.includes(token)) {
      // for tokens from require statements
      return;
    }

    if (isStringLiteralToken(token) && !jsxTokens.includes(token)) {
      text = 'LITERAL';
    }

    const startPosition = token.loc.start;
    const endPosition = token.loc.end;

    cpdTokens.push({
      location: {
        startLine: startPosition.line,
        startCol: startPosition.column,
        endLine: endPosition.line,
        endCol: endPosition.column,
      },
      image: text,
    });
  });

  return { cpdTokens };
}

/**
 * Extracts specific tokens to be ignored by copy-paste detection
 * @param sourceCode the source code to extract from
 * @returns a list of tokens to be ignored
 */
function extractTokens(sourceCode: SourceCode): {
  jsxTokens: AST.Token[];
  importTokens: AST.Token[];
  requireTokens: AST.Token[];
} {
  const jsxTokens: AST.Token[] = [];
  const importTokens: AST.Token[] = [];
  const requireTokens: AST.Token[] = [];
  visit(sourceCode, (node: estree.Node) => {
    const tsNode = node as TSESTree.Node;
    switch (tsNode.type) {
      case 'JSXAttribute':
        if (tsNode.value?.type === 'Literal') {
          jsxTokens.push(...sourceCode.getTokens(tsNode.value as estree.Node));
        }
        break;
      case 'ImportDeclaration':
        importTokens.push(...sourceCode.getTokens(tsNode as estree.Node));
        break;
      case 'CallExpression':
        if (tsNode.callee.type === 'Identifier' && tsNode.callee.name === 'require') {
          requireTokens.push(...sourceCode.getTokens(tsNode as estree.Node));
        }
        break;
    }
  });
  return { jsxTokens, importTokens, requireTokens };
}

function isStringLiteralToken(token: AST.Token) {
  return token.value.startsWith('"') || token.value.startsWith("'") || token.value.startsWith('`');
}
