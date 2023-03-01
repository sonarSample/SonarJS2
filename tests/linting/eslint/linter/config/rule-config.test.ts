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
import { Rule } from 'eslint';
import { setContext } from 'helpers';
import { extendRuleConfig, RuleConfig } from 'linting/eslint';
import { SONAR_CONTEXT, SONAR_RUNTIME } from 'linting/eslint/linter/parameters';

describe('extendRuleConfig', () => {
  it('should include `sonar-runtime`', () => {
    const ruleModule = { meta: { schema: [{ enum: SONAR_RUNTIME }] } } as any as Rule.RuleModule;
    const inputRule: RuleConfig = {
      key: 'some-rule',
      configurations: [42],
      fileTypeTarget: ['MAIN'],
    };

    const config = extendRuleConfig(ruleModule, inputRule);
    expect(config).toEqual([42, SONAR_RUNTIME]);
  });

  it('should include the context', () => {
    const ctx = {
      workDir: '/tmp/dir',
      shouldUseTypeScriptParserForJS: true,
      sonarlint: false,
      bundles: [],
    };
    setContext(ctx);

    const ruleModule = { meta: { schema: [{ title: SONAR_CONTEXT }] } } as any as Rule.RuleModule;
    const inputRule: RuleConfig = {
      key: 'some-rule',
      configurations: [42],
      fileTypeTarget: ['MAIN'],
    };

    const config = extendRuleConfig(ruleModule, inputRule);
    expect(config).toEqual([42, ctx]);
  });

  it('should include the context and `sonar-runtime`', () => {
    const ctx = {
      workDir: '/tmp/dir',
      shouldUseTypeScriptParserForJS: true,
      sonarlint: false,
      bundles: [],
    };
    setContext(ctx);

    const ruleModule = {
      meta: { schema: [{ enum: SONAR_RUNTIME, title: SONAR_CONTEXT }] },
    } as any as Rule.RuleModule;
    const inputRule: RuleConfig = {
      key: 'some-rule',
      configurations: [42],
      fileTypeTarget: ['MAIN'],
    };

    const config = extendRuleConfig(ruleModule, inputRule);
    expect(config).toEqual([42, SONAR_RUNTIME, ctx]);
  });
});
