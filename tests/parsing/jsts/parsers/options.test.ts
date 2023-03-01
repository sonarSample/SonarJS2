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
import { buildParserOptions } from 'parsing/jsts';
import { JsTsAnalysisInput } from 'services/analysis';
import { createProgram, getProgramById } from 'services/program';
import path from 'path';

describe('buildParserOptions', () => {
  it('should build parser options', () => {
    const filePath = '/tmp/dir';
    const input = { filePath } as JsTsAnalysisInput;
    const usingBabel = false;
    const parserOption = '/some/parser';
    const sourceType = 'module';
    expect(buildParserOptions(input, usingBabel, parserOption, sourceType)).toEqual({
      tokens: true,
      comment: true,
      loc: true,
      range: true,
      ecmaVersion: 2018,
      sourceType,
      codeFrame: false,
      ecmaFeatures: {
        jsx: true,
        globalReturn: false,
        legacyDecorators: true,
      },
      extraFileExtensions: ['.vue'],
      parser: parserOption,
      filePath: input.filePath,
      project: undefined,
      programs: undefined,
    });
  });

  it('should include Babel parser options', () => {
    const filePath = '/tmp/dir';
    const input = { filePath } as JsTsAnalysisInput;
    const usingBabel = true;
    const parserOptions = buildParserOptions(input, usingBabel);
    expect(parserOptions).toEqual(
      expect.objectContaining({
        requireConfigFile: false,
      }),
    );
    expect(parserOptions.babelOptions).toEqual(
      expect.objectContaining({
        babelrc: false,
        configFile: false,
      }),
    );
  });

  it('should build parser options with TSConfig', () => {
    const tsConfigs = ['/some/tsconfig'];
    const filePath = '/tmp/dir';
    const input = { filePath, tsConfigs: tsConfigs } as JsTsAnalysisInput;
    expect(buildParserOptions(input)).toEqual(
      expect.objectContaining({
        project: tsConfigs,
      }),
    );
  });

  it('should build parser options with TypeScript program', async () => {
    const tsConfig = path.join(__dirname, 'fixtures', 'options', 'tsconfig.json');

    const { programId } = await createProgram(tsConfig);
    const program = getProgramById(programId);

    const filePath = '/tmp/dir';
    const input = { filePath, programId } as JsTsAnalysisInput;
    expect(buildParserOptions(input)).toEqual(
      expect.objectContaining({
        programs: [program],
      }),
    );
  });
});
