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
import { Linter, Rule } from 'eslint';
import { eslintRules } from 'linting/eslint/rules/core';
import { rules as pluginRules } from 'eslint-plugin-sonarjs';
import { rules as reactESLintRules } from 'eslint-plugin-react';
import { rules as typescriptESLintRules } from '@typescript-eslint/eslint-plugin';
import { rules as internalRules } from 'linting/eslint';
import { customRules as internalCustomRules, CustomRule } from './custom-rules';
import { decorateExternalRules } from './decoration';
import { debug, getContext } from 'helpers';

export function loadCustomRules(linter: Linter, rules: CustomRule[] = []) {
  for (const rule of rules) {
    linter.defineRule(rule.ruleId, rule.ruleModule);
  }
}

export function loadBundles(linter: Linter, rulesBundles: (keyof typeof loaders)[]) {
  for (const bundleId of rulesBundles) {
    loaders[bundleId](linter);
  }
}

/**
 * Loaders for each of the predefined rules bundles. Each bundle comes with a
 * different data structure (array/record/object), plus on some cases
 * there are specifics that must be taken into account, like ignoring some
 * rules from some bundles or decorating them in order to be compatible.
 */
const loaders: { [key: string]: Function } = {
  /**
   * Loads external rules
   *
   * The external ESLint-based rules include all the rules that are
   * not implemented internally, in other words, rules from external
   * dependencies which include ESLint core rules. Furthermore, the
   * returned rules are decorated either by internal decorators or by
   * special decorations.
   */
  externalRules(linter: Linter) {
    const externalRules: { [key: string]: Rule.RuleModule } = {};
    /**
     * The order of defining rules from external dependencies is important here.
     * Core ESLint rules could be overridden by the implementation from specific
     * dependencies, which should be the default behaviour in most cases. If for
     * some reason a different behaviour is needed for a particular rule, one can
     * specify it in `decorateExternalRules`.
     */
    const dependencies = [eslintRules, typescriptESLintRules, reactESLintRules];
    for (const dependencyRules of dependencies) {
      for (const [name, module] of Object.entries(dependencyRules)) {
        externalRules[name] = module;
      }
    }
    linter.defineRules(decorateExternalRules(externalRules));
  },
  /**
   * Loads plugin rules
   *
   * Adds the rules from the Sonar ESLint plugin.
   */
  pluginRules(linter: Linter) {
    linter.defineRules(pluginRules);
  },
  /**
   * Loads internal rules
   *
   * Adds the rules from SonarJS plugin, i.e. rules in path
   * /src/linting/eslint/rules
   */
  internalRules(linter: Linter) {
    linter.defineRules(internalRules);
  },
  /**
   * Loads global context rules
   *
   * Context bundles define a set of external custom rules (like the taint analysis rule)
   * including rule keys and rule definitions that cannot be provided to the linter
   * wrapper using the same feeding channel as rules from the active quality profile.
   */
  contextRules(linter: Linter) {
    const { bundles } = getContext();
    const customRules: CustomRule[] = [];
    for (const ruleBundle of bundles) {
      const bundle = require(ruleBundle);
      customRules.push(...bundle.rules);
      const ruleIds = bundle.rules.map((r: CustomRule) => r.ruleId);
      debug(`Loaded rules ${ruleIds} from ${ruleBundle}`);
    }
    loadCustomRules(linter, customRules);
  },
  /**
   * Loads internal custom rules
   *
   * These are rules used internally by SonarQube to have the symbol highlighting and
   * the cognitive complexity metrics.
   */
  internalCustomRules(linter: Linter) {
    loadCustomRules(linter, internalCustomRules);
  },
};
