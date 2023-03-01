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
import { Linter, SourceCode } from 'eslint';
import { loadBundles, loadCustomRules } from './bundle-loader';
import { createLinterConfig, RuleConfig } from './config';
import { FileType } from 'helpers';
import { transformMessages, LintingResult } from './issues';
import { CustomRule } from './custom-rules';

/**
 * Wrapper's constructor initializer. All the parameters are optional,
 * having the option to create a Linter without any additional rules
 * loaded, aside of the preexisting ESLint core rules.
 *
 * @param inputRules the quality profile rules, enabled rules
 * @param environments the JavaScript environments
 * @param globals the global variables
 * @param ruleBundles the bundles of rules to load in the linter
 * @param customRules array of rules to load in the linter
 */
export interface WrapperOptions {
  inputRules?: RuleConfig[];
  environments?: string[];
  globals?: string[];
  ruleBundles?: string[];
  customRules?: CustomRule[];
}

/**
 * When a linter is created, by default all these bundles of rules will
 * be loaded into the linter internal rules map. This behaviour can be
 * adjusted by passing which bundles, if any, should be loaded instead.
 * The order of this array is important here. Rules from a previous bundle
 * will be overridden by the implementation of the same rule key in a
 * subsequent bundle.
 */
const defaultRuleBundles = [
  'externalRules',
  'pluginRules',
  'internalRules',
  'contextRules',
  'internalCustomRules',
];

/**
 * A wrapper of ESLint linter
 *
 * The purpose of the wrapper is to configure the behaviour of ESLint linter,
 * which includes:
 *
 * - defining the rules that should be used during linting,
 * - declaring globals that need to be considered as such
 * - defining the environments bringing a set of predefined variables
 *
 * Because some rules target main files while other target test files (or even
 * both), the wrapper relies on two linting configurations to decide which set
 * of rules should be considered during linting.
 *
 * Last but not least, the linter wrapper eventually turns ESLint problems,
 * also known as messages, into SonarQube issues.
 */
export class LinterWrapper {
  /** The wrapper's internal ESLint linter instance */
  readonly linter: Linter;

  /** The wrapper's linting configuration */
  readonly config: { [key in FileType]: Linter.Config };

  /**
   * Constructs an ESLint linter wrapper
   *
   * Constructing a linter wrapper consists in building the rule database
   * the internal ESLint linter shall consider during linting. Furthermore,
   * it creates a linting configuration that configures which rules should
   * be used on linting based on the active quality profile and file type.
   *
   * The order of defining rules is important here because internal rules
   * and external ones might share the same name by accident, which would
   * unexpectedly overwrite the behaviour of the internal one in favor of
   * the external one. This is why some internal rules are named with the
   * prefix `sonar-`, e.g., `sonar-no-fallthrough`.
   *
   * @param options the wrapper's options
   */
  constructor(options: WrapperOptions = {}) {
    this.linter = new Linter();
    loadBundles(this.linter, options.ruleBundles ?? defaultRuleBundles);
    loadCustomRules(this.linter, options.customRules);
    this.config = this.createConfig(options);
  }

  /**
   * Lints an ESLint source code instance
   *
   * Linting a source code implies using ESLint linting functionality to find
   * problems in the code. It selects which linting configuration needs to be
   * considered during linting based on the file type.
   *
   * @param sourceCode the ESLint source code
   * @param filePath the path of the source file
   * @param fileType the type of the source file
   * @returns the linting result
   */
  lint(sourceCode: SourceCode, filePath: string, fileType: FileType = 'MAIN'): LintingResult {
    const fileTypeConfig = this.config[fileType];
    const config = { ...fileTypeConfig, settings: { ...fileTypeConfig.settings, fileType } };
    const options = { filename: filePath, allowInlineConfig: false };
    const messages = this.linter.verify(sourceCode, config, options);
    return transformMessages(messages, { sourceCode, rules: this.linter.getRules() });
  }

  /**
   * Creates the wrapper's linting configuration
   *
   * The wrapper's linting configuration actually includes two
   * ESLint configurations: one per file type.
   *
   * @returns the wrapper's linting configuration
   */
  private createConfig(options: WrapperOptions) {
    const mainRules: RuleConfig[] = [];
    const testRules: RuleConfig[] = [];
    for (const inputRule of options.inputRules ?? []) {
      if (inputRule.fileTypeTarget.includes('MAIN')) {
        mainRules.push(inputRule);
      }
      if (inputRule.fileTypeTarget.includes('TEST')) {
        testRules.push(inputRule);
      }
    }
    const linterRules = this.linter.getRules();
    const mainConfig = createLinterConfig(
      mainRules,
      linterRules,
      options.environments ?? [],
      options.globals ?? [],
    );
    const testConfig = createLinterConfig(
      testRules,
      linterRules,
      options.environments ?? [],
      options.globals ?? [],
    );
    return { ['MAIN']: mainConfig, ['TEST']: testConfig };
  }
}
