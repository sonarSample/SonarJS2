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
// https://sonarsource.github.io/rspec/#/rspec/S5860/javascript

import { Rule, Scope } from 'eslint';
import * as estree from 'estree';
import * as regexpp from 'regexpp';
import { Backreference, CapturingGroup, RegExpLiteral } from 'regexpp/ast';
import {
  getLhsVariable,
  getUniqueWriteUsage,
  getValueOfExpression,
  getVariableFromName,
  isDotNotation,
  isIndexNotation,
  isMethodCall,
  isObjectDestructuring,
  isRequiredParserServices,
  isString,
  RequiredParserServices,
  toEncodedMessage,
} from './helpers';
import {
  extractReferences,
  getParsedRegex,
  getRegexpLocation,
  isStringRegexMethodCall,
  isStringReplaceCall,
} from './helpers/regex';
import { SONAR_RUNTIME } from 'linting/eslint/linter/parameters';
import { TSESTree } from '@typescript-eslint/experimental-utils';

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
    const services = context.parserServices;
    if (!isRequiredParserServices(services)) {
      return {};
    }
    const intellisense = new RegexIntelliSense(services, context);
    return {
      'Literal[regex]:exit': (literal: estree.Literal) => {
        /* /regex/ */
        intellisense.collectKnowledge(literal);
      },
      'NewExpression:exit': (newExpr: estree.NewExpression) => {
        /* new RegExp(regex) */
        intellisense.collectKnowledge(newExpr);
      },
      'CallExpression:exit': (callExpr: estree.CallExpression) => {
        /* RegExp(regex), implicit regex e.g. str.match('regex') */
        intellisense.collectKnowledge(callExpr);
        /* str.match(pattern) / pattern.exec(str) */
        intellisense.collectPatternMatcher(callExpr);
        /* str.replace(pattern, substr) */
        checkStringReplaceGroupReferences(callExpr, intellisense);
      },
      'MemberExpression:exit': (memberExpr: estree.MemberExpression) => {
        if (memberExpr.computed) {
          /* matcher[index] */
          checkIndexBasedGroupReference(memberExpr, intellisense);
        } else {
          /* matcher.groups.<name> / matcher.indices.groups.<name> */
          checkNonExistingGroupReference(memberExpr, intellisense);
        }
      },
      'Program:exit': () => {
        checkUnusedGroups(intellisense);
        checkIndexedGroups(intellisense);
      },
    };
  },
};

function checkStringReplaceGroupReferences(
  callExpr: estree.CallExpression,
  intellisense: RegexIntelliSense,
) {
  if (isStringReplaceCall(callExpr, intellisense.services)) {
    const [pattern, substr] = callExpr.arguments;
    const regex = intellisense.findRegex(pattern);
    if (regex) {
      const references = extractReferences(substr);
      const indexes = new Set<number>();
      const names = new Set<string>();
      references.forEach(ref =>
        isNaN(Number(ref.value)) ? names.add(ref.value) : indexes.add(Number(ref.value)),
      );
      regex.groups.forEach(group => {
        group.used ||= names.has(group.name);
        group.used ||= indexes.has(group.index);
      });
      const indexedGroups = regex.groups.filter(group => indexes.has(group.index));
      if (indexedGroups.length > 0) {
        intellisense.context.report({
          message: toEncodedMessage(
            `Directly use the group names instead of their numbers.`,
            indexedGroups.map(group => ({
              loc: getRegexpLocation(regex.node, group.node, intellisense.context),
            })),
            indexedGroups.map(group => `Group '${group.name}'`),
          ),
          node: substr,
        });
      }
    }
  }
}

function checkIndexBasedGroupReference(
  memberExpr: estree.MemberExpression,
  intellisense: RegexIntelliSense,
) {
  const { object: matcher, property } = memberExpr;
  const regex = intellisense.resolve(matcher);
  if (regex) {
    const maybeIndex = getValueOfExpression(intellisense.context, property, 'Literal');
    if (maybeIndex && typeof maybeIndex.value === 'number') {
      const index = maybeIndex.value;
      const group = regex.groups.find(grp => grp.index === index);
      if (group) {
        group.used = true;
        intellisense.context.report({
          message: toEncodedMessage(
            `Directly use '${group.name}' instead of its group number.`,
            [{ loc: getRegexpLocation(regex.node, group.node, intellisense.context) }],
            [`Group '${group.name}'`],
          ),
          node: property,
        });
      }
    }
  }
}

function checkNonExistingGroupReference(
  memberExpr: estree.MemberExpression,
  intellisense: RegexIntelliSense,
) {
  const { object: matcher } = memberExpr;
  const regex = intellisense.resolve(matcher);
  if (regex) {
    /* matcher.groups.<name> / matcher.indices.groups.<name>  */
    const groupNodes = extractGroupNodes(memberExpr, intellisense);
    for (const groupNode of groupNodes) {
      const groupName = groupNode.type === 'Identifier' ? groupNode.name : groupNode.value;
      const group = regex.groups.find(grp => grp.name === groupName);
      if (group) {
        group.used = true;
      } else {
        intellisense.context.report({
          message: toEncodedMessage(
            `There is no group named '${groupName}' in the regular expression.`,
            regex.groups.map(grp => ({
              loc: getRegexpLocation(regex.node, grp.node, intellisense.context),
            })),
            regex.groups.map(grp => `Named group '${grp.name}'`),
          ),
          node: groupNode,
        });
      }
    }
  }
}

function extractGroupNodes(memberExpr: estree.MemberExpression, intellisense: RegexIntelliSense) {
  if (isDotNotation(memberExpr)) {
    const { property } = memberExpr;
    const ancestors = intellisense.context.getAncestors();
    let parent = ancestors.pop();
    while ((parent as TSESTree.Node).type === 'TSNonNullExpression') {
      parent = ancestors.pop();
    }
    if (parent) {
      switch (property.name) {
        case 'groups':
          /* matcher.groups.<name> or matcher.groups['name'] */
          return extractNamedOrDestructuredGroupNodes(parent);
        case 'indices':
          /* matcher.indices.groups.<name> or matcher.indices.groups['name'] */
          if (isDotNotation(parent) && parent.property.name === 'groups') {
            parent = ancestors.pop();
            if (parent) {
              return extractNamedOrDestructuredGroupNodes(parent);
            }
          }
      }
    }
  }
  return [];
}

function extractNamedOrDestructuredGroupNodes(node: estree.Node) {
  if (isDotNotation(node) || isIndexNotation(node)) {
    /* matcher.groups.<name> or matcher.groups['name'] */
    return [node.property];
  } else if (isObjectDestructuring(node)) {
    /* { <name1>,..<nameN> } = matcher.groups */
    const destructuredGroups: estree.Identifier[] = [];
    const pattern = node.type === 'VariableDeclarator' ? node.id : node.left;
    for (const property of pattern.properties) {
      if (property.type === 'Property' && property.key.type === 'Identifier') {
        destructuredGroups.push(property.key);
      }
    }
    return destructuredGroups;
  } else {
    return [];
  }
}

function checkUnusedGroups(intellisense: RegexIntelliSense) {
  intellisense.getKnowledge().forEach(regex => {
    if (regex.matched) {
      const unusedGroups = regex.groups.filter(group => !group.used);
      if (unusedGroups.length) {
        intellisense.context.report({
          message: toEncodedMessage(
            'Use the named groups of this regex or remove the names.',
            unusedGroups.map(grp => ({
              loc: getRegexpLocation(regex.node, grp.node, intellisense.context),
            })),
            unusedGroups.map(grp => `Named group '${grp.name}'`),
          ),
          node: regex.node,
        });
      }
    }
  });
}

function checkIndexedGroups(intellisense: RegexIntelliSense) {
  intellisense.getKnowledge().forEach(regex => {
    regex.groups.forEach(group =>
      group.node.references.forEach(reference => {
        if (typeof reference.ref === 'number') {
          intellisense.context.report({
            message: toEncodedMessage(
              `Directly use '${group.name}' instead of its group number.`,
              [{ loc: getRegexpLocation(regex.node, group.node, intellisense.context) }],
              [`Group '${group.name}'`],
            ),
            loc: getRegexpLocation(regex.node, reference, intellisense.context),
          });
        }
      }),
    );
  });
}

interface RegexKnowledge {
  node: estree.Node;
  regexp: RegExpLiteral;
  groups: GroupKnowledge[];
  matched: boolean;
}

interface GroupKnowledge {
  node: CapturingGroup;
  name: string;
  used: boolean;
  index: number;
}

function makeRegexKnowledge(node: estree.Node, regexp: RegExpLiteral): RegexKnowledge {
  const capturingGroups: CapturingGroup[] = [];
  const backreferences: Backreference[] = [];
  regexpp.visitRegExpAST(regexp, {
    onBackreferenceEnter: reference => reference.resolved.name && backreferences.push(reference),
    onCapturingGroupEnter: group => capturingGroups.push(group),
  });
  const groups: GroupKnowledge[] = [];
  capturingGroups.forEach(
    (group, index) =>
      group.name && groups.push(makeGroupKnowledge(group, backreferences, index + 1)),
  );
  return { node, regexp, groups, matched: false };
}

function makeGroupKnowledge(
  node: CapturingGroup,
  backreferences: Backreference[],
  index: number,
): GroupKnowledge {
  const name = node.name!;
  const used = backreferences.some(backreference => backreference.resolved === node);
  return { node, name, used, index };
}

class RegexIntelliSense {
  private readonly knowledge: RegexKnowledge[] = [];
  private readonly bindings = new Map<Scope.Variable, RegexKnowledge>();

  constructor(readonly services: RequiredParserServices, readonly context: Rule.RuleContext) {}

  getKnowledge() {
    return this.knowledge;
  }

  collectKnowledge(node: estree.Node) {
    let regexNode = node;
    if (node.type === 'CallExpression' && isStringRegexMethodCall(node, this.services)) {
      /* implicit regex */
      regexNode = node.arguments[0];
    }
    const regex = getParsedRegex(regexNode, this.context);
    if (regex !== null) {
      this.knowledge.push(makeRegexKnowledge(regexNode, regex));
    }
  }

  collectPatternMatcher(callExpr: estree.CallExpression) {
    const { callee, arguments: args } = callExpr;
    if (isMethodCall(callExpr) && args.length > 0) {
      const target = (callee as estree.MemberExpression).object;
      const matcher = getLhsVariable(this.context);
      if (matcher) {
        const method = (callee as estree.MemberExpression).property as estree.Identifier;
        if (isString(target, this.services) && ['match', 'matchAll'].includes(method.name)) {
          /* str.match(pattern) */
          const [pattern] = args;
          this.bind(pattern, matcher);
        } else if (method.name === 'exec' && isString(args[0], this.services)) {
          /* pattern.exec(str) */
          const pattern = target;
          this.bind(pattern, matcher);
        }
      }
    }
  }

  resolve(matcher: estree.Node): RegexKnowledge | null {
    const variable = this.findVariable(matcher);
    if (variable) {
      return this.bindings.get(variable) || null;
    } else {
      return null;
    }
  }

  findRegex(node: estree.Node): RegexKnowledge | undefined {
    return this.findRegexRec(node, new Set<estree.Node>());
  }

  private findRegexRec(node: estree.Node, visited: Set<estree.Node>): RegexKnowledge | undefined {
    if (!visited.has(node)) {
      visited.add(node);
      const variable = this.findVariable(node);
      if (variable) {
        const value = getUniqueWriteUsage(this.context, variable.name);
        if (value) {
          const regex = this.findRegexRec(value, visited);
          if (regex) {
            return regex;
          }
        }
      }
    }
    return this.knowledge.find(regex => regex.node === node);
  }

  private bind(pattern: estree.Node, matcher: Scope.Variable) {
    const regex = this.findRegex(pattern);
    if (regex) {
      regex.matched = true;
      this.bindings.set(matcher, regex);
    }
  }

  private findVariable(node: estree.Node) {
    if (node.type === 'Identifier') {
      return getVariableFromName(this.context, node.name);
    }
    return null;
  }
}
