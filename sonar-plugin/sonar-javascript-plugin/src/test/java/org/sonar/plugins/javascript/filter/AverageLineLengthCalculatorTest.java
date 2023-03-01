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
package org.sonar.plugins.javascript.filter;

import java.nio.charset.StandardCharsets;
import java.nio.file.Paths;
import org.junit.jupiter.api.Test;
import org.sonar.api.batch.fs.internal.DefaultInputFile;
import org.sonar.api.batch.fs.internal.TestInputFileBuilder;

import static org.assertj.core.api.Assertions.assertThat;

class AverageLineLengthCalculatorTest {

  private final static String DIR = "src/test/resources/minify/";


  @Test
  void noHeaderComment1() {
    check("average1.js", 10);
  }


  @Test
  void noHeaderComment2() {
    check("average2.js", 7);
  }

  @Test
  void headerCommentOnOneLine() {
    check("average3.js", 10);
  }

  @Test
  void headerCommentSimple() {
    check("average4.js", 10);
  }

  @Test
  void headerCommentWithAppendedComment() {
    check("average5.js", 13);
  }

  @Test
  void headerCommentWithAppendedInstruction() {
    check("average6.js", 20);
  }

  @Test
  void headerCommentWithCplusplusStyle() {
    check("average7.js", 13);
  }

  @Test
  void oneline() {
    check("oneline.css", 474);
  }

  private void check(String fileName, int expectedAverage) {
    DefaultInputFile file = new TestInputFileBuilder("module", DIR + fileName)
      .setModuleBaseDir(Paths.get(""))
      .setCharset(StandardCharsets.UTF_8)
      .build();
    AverageLineLengthCalculator calc = new AverageLineLengthCalculator(file);
    assertThat(calc.getAverageLineLength()).isEqualTo(expectedAverage);
  }

}
