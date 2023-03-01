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
package org.sonar.plugins.javascript.nodejs;

import com.google.gson.Gson;
import java.io.File;
import java.io.IOException;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.sonar.api.config.Configuration;
import org.sonar.api.config.internal.MapSettings;
import org.sonar.api.utils.Version;
import org.sonar.api.utils.log.LogTesterJUnit5;
import org.sonar.api.utils.log.LoggerLevel;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NodeCommandTest {

  private static final String PATH_TO_SCRIPT = "files/script.js";

  @RegisterExtension
  LogTesterJUnit5 logTester = new LogTesterJUnit5();

  @TempDir
  Path tempDir;

  @Captor
  private ArgumentCaptor<List<String>> processStartArgument;

  @Mock
  private ProcessWrapper mockProcessWrapper;

  @BeforeEach
  public void setUp() throws Exception {
    MockitoAnnotations.initMocks(this);
    when(mockProcessWrapper.startProcess(any(), any(), any(), any())).thenReturn(mock(Process.class));
  }

  @Test
  void test() throws Exception {
    NodeCommand nodeCommand = NodeCommand.builder()
      .script(resourceScript(PATH_TO_SCRIPT))
      .pathResolver(getPathResolver())
      .build();
    nodeCommand.start();
    int exitValue = nodeCommand.waitFor();
    assertThat(exitValue).isEqualTo(0);
  }

  @Test
  void test_output_error_consumer() throws Exception {
    StringBuilder output = new StringBuilder();
    StringBuilder error = new StringBuilder();
    NodeCommand nodeCommand = NodeCommand.builder()
      .script(resourceScript("files/error.js"))
      .outputConsumer(output::append)
      .errorConsumer(error::append)
      .pathResolver(getPathResolver())
      .build();
    nodeCommand.start();
    int exitValue = nodeCommand.waitFor();
    assertThat(output.toString()).isEqualTo("Hello!");
    assertThat(error.toString()).isEqualTo("Error!");
    assertThat(exitValue).isEqualTo(1);
  }

  @Test
  void test_min_version() throws IOException {
    assertThatThrownBy(() -> NodeCommand.builder()
      .minNodeVersion(Version.create(99, 0))
      .pathResolver(getPathResolver())
      .build())
      .isInstanceOf(NodeCommandException.class)
      .hasMessageStartingWith("Only Node.js v99.0 or later is supported, got");
  }

  @Test
  void test_mac_default_executable_not_found() throws IOException {
    when(mockProcessWrapper.isMac()).thenReturn(true);

    assertThatThrownBy(() -> NodeCommand.builder(mockProcessWrapper)
      .pathResolver(p -> "/file/does/not/exist")
      .build())
      .isInstanceOf(NodeCommandException.class)
      .hasMessage("Default Node.js executable for MacOS does not exist.");
  }

  @Test
  void test_min_version_positive() throws Exception {
    NodeCommand nodeCommand = NodeCommand.builder()
      .minNodeVersion(Version.create(1, 0))
      .script(resourceScript(PATH_TO_SCRIPT))
      .pathResolver(getPathResolver())
      .build();

    nodeCommand.start();
    int exitValue = nodeCommand.waitFor();
    assertThat(exitValue).isZero();
  }

  @Test
  void test_version_check() {
    assertThat(NodeCommandBuilderImpl.nodeVersion("v5.1.1")).isEqualTo(Version.create(5, 1, 1));
    assertThat(NodeCommandBuilderImpl.nodeVersion("v10.8.0")).isEqualTo(Version.create(10, 8, 0));
    assertThat(NodeCommandBuilderImpl.nodeVersion("v10.8.0+123")).isEqualTo(Version.create(10, 8, 0));

    assertThatThrownBy(() -> NodeCommandBuilderImpl.nodeVersion("Invalid version"))
      .isInstanceOf(NodeCommandException.class)
      .hasMessage("Failed to parse Node.js version, got 'Invalid version'");
  }

  @Test
  void test_max_old_space_size_setting() throws IOException {
    String request = "v8.getHeapStatistics()";
    StringBuilder output = new StringBuilder();
    NodeCommand command = NodeCommand.builder()
      .maxOldSpaceSize(2048)
      .nodeJsArgs("-p", request)
      .outputConsumer(output::append)
      .pathResolver(getPathResolver())
      .build();
    command.start();
    command.waitFor();
    Map map = new Gson().fromJson(output.toString(), Map.class);
    double total_available_size = (double) map.get("total_available_size");
    assertThat(total_available_size).isGreaterThan(2048 * 1000);
  }

  @Test
  void test_executable_from_configuration() throws Exception {
    String NODE_EXECUTABLE_PROPERTY = "sonar.nodejs.executable";
    Path nodeExecutable = Files.createFile(tempDir.resolve("custom-node")).toAbsolutePath();
    MapSettings mapSettings = new MapSettings();
    mapSettings.setProperty(NODE_EXECUTABLE_PROPERTY, nodeExecutable.toString());
    Configuration configuration = mapSettings.asConfig();
    NodeCommand nodeCommand = NodeCommand.builder(mockProcessWrapper)
      .configuration(configuration)
      .script("not-used")
      .build();
    nodeCommand.start();

    List<String> value = captureProcessWrapperArgument();
    assertThat(value).contains(nodeExecutable.toString());
    await().until(() -> logTester.logs(LoggerLevel.INFO)
      .contains("Using Node.js executable " + nodeExecutable + " from property " + NODE_EXECUTABLE_PROPERTY + "."));
  }

  @Test
  void test_empty_configuration() throws Exception {
    NodeCommand nodeCommand = NodeCommand.builder(mockProcessWrapper)
      .configuration(new MapSettings().asConfig())
      .script("not-used")
      .build();
    nodeCommand.start();

    List<String> value = captureProcessWrapperArgument();
    assertThat(value).contains("node");
  }

  private List<String> captureProcessWrapperArgument() throws IOException {
    verify(mockProcessWrapper).startProcess(processStartArgument.capture(), any(), any(), any());
    return processStartArgument.getValue();
  }

  @Test
  void test_non_existing_node_file() throws Exception {
    MapSettings settings = new MapSettings();
    settings.setProperty("sonar.nodejs.executable", "non-existing-file");
    NodeCommandBuilder nodeCommand = NodeCommand.builder(mockProcessWrapper)
      .configuration(settings.asConfig())
      .script("not-used");

    assertThatThrownBy(nodeCommand::build)
      .isInstanceOf(NodeCommandException.class)
      .hasMessage("Provided Node.js executable file does not exist.");

    await().until(() -> logTester.logs(LoggerLevel.ERROR)
      .contains("Provided Node.js executable file does not exist. Property 'sonar.nodejs.executable' was set to 'non-existing-file'"));
  }

  @Test
  void test_exception_start() throws Exception {
    IOException cause = new IOException("Error starting process");
    when(mockProcessWrapper.startProcess(any(), any(), any(), any())).thenThrow(cause);
    NodeCommand nodeCommand = NodeCommand.builder(mockProcessWrapper)
      .script(resourceScript(PATH_TO_SCRIPT))
      .build();
    assertThatThrownBy(nodeCommand::start)
      .isInstanceOf(NodeCommandException.class)
      .hasMessageStartingWith("Error when running: '")
      .hasCause(cause);
  }

  @Test
  void test_interrupted_waitFor() throws Exception {
    when(mockProcessWrapper.waitFor(any(), anyLong(), any())).thenThrow(new InterruptedException());
    NodeCommand nodeCommand = NodeCommand.builder(mockProcessWrapper)
      .script(resourceScript(PATH_TO_SCRIPT))
      .build();
    nodeCommand.start();
    int exitValue = nodeCommand.waitFor();
    verify(mockProcessWrapper).interrupt();
    assertThat(logTester.logs()).contains("Interrupted while waiting for process to terminate.");
    assertThat(exitValue).isEqualTo(1);
  }

  @Test
  void test_timeout_waitFor() throws Exception {
    when(mockProcessWrapper.waitFor(any(), anyLong(), any())).thenReturn(false);
    NodeCommand nodeCommand = NodeCommand.builder(mockProcessWrapper)
      .script(resourceScript(PATH_TO_SCRIPT))
      .build();
    nodeCommand.start();
    int exitValue = nodeCommand.waitFor();
    verify(mockProcessWrapper).destroyForcibly(any());
    assertThat(logTester.logs()).contains("Node process did not stop in a timely fashion");
    assertThat(exitValue).isEqualTo(-1);
  }

  @Test
  void test_no_args() {
    NodeCommandBuilder commandBuilder = NodeCommand.builder(mockProcessWrapper);
    assertThatThrownBy(commandBuilder::build)
      .isInstanceOf(IllegalArgumentException.class)
      .hasMessage("Missing arguments for Node.js.");
  }

  @Test
  void test_script_args() {
    NodeCommandBuilder commandBuilder = NodeCommand.builder(mockProcessWrapper).scriptArgs("arg");
    assertThatThrownBy(commandBuilder::build)
      .isInstanceOf(IllegalArgumentException.class)
      .hasMessage("No script provided, but script arguments found.");
  }

  @Test
  void test_failed_get_version() throws Exception {
    when(mockProcessWrapper.waitFor(any(), anyLong(), any())).thenReturn(true);
    when(mockProcessWrapper.exitValue(any())).thenReturn(1);
    NodeCommandBuilder commandBuilder = NodeCommand.builder(mockProcessWrapper)
      .minNodeVersion(Version.create(8, 0))
      .script(resourceScript(PATH_TO_SCRIPT));
    assertThatThrownBy(commandBuilder::build)
      .isInstanceOf(NodeCommandException.class)
      .hasMessage("Failed to determine the version of Node.js, exit value 1. Executed: 'node -v'");
  }

  @Test
  void test_toString() throws IOException {
    when(mockProcessWrapper.isMac()).thenReturn(false);
    NodeCommand nodeCommand = NodeCommand.builder(mockProcessWrapper)
      .nodeJsArgs("-v")
      .script("script.js")
      .scriptArgs("arg1", "arg2")
      .build();

    assertThat(nodeCommand.toString()).endsWith("node -v script.js arg1 arg2");
  }

  @Test
  void test_command_on_mac() throws Exception {
    if (System.getProperty("os.name").toLowerCase().contains("win")) {
      // we can't test this on Windows as we are setting permissions
      return;
    }
    when(mockProcessWrapper.isMac()).thenReturn(true);
    NodeCommand nodeCommand = NodeCommand.builder(mockProcessWrapper)
      .script("script.js")
      .pathResolver(getPathResolver())
      .build();
    nodeCommand.start();
    List<String> value = captureProcessWrapperArgument();
    assertThat(value).hasSize(2);
    assertThat(value.get(0)).endsWith("src/test/resources/package/node_modules/run-node/run-node");
    assertThat(value.get(1)).isEqualTo("script.js");
  }

  @Test
  void test_missing_node() throws Exception {
    when(mockProcessWrapper.startProcess(any(), any(), any(), any())).thenThrow(new IOException("CreateProcess error=2"));
    NodeCommand nodeCommand = NodeCommand.builder(mockProcessWrapper)
      .script("not-used")
      .build();

    assertThatThrownBy(nodeCommand::start).isInstanceOf(NodeCommandException.class);
  }

  @Test
  void test_actual_node_version() throws Exception {
    Consumer<String> noop = s -> {
    };
    NodeCommand nodeCommand = new NodeCommand(mockProcessWrapper, "node", Version.create(12, 0), Collections.emptyList(), null,
      Collections.emptyList(), noop, noop, Map.of());
    assertThat(nodeCommand.getActualNodeVersion().major()).isEqualTo(12);
  }

  @Test
  void test_windows_default_node() throws Exception {
    when(mockProcessWrapper.isWindows()).thenReturn(true);
    when(mockProcessWrapper.startProcess(processStartArgument.capture(), any(), any(), any())).then(invocation -> {
      invocation.getArgument(2, Consumer.class).accept("C:\\Program Files\\node.exe");
      return mock(Process.class);
    });
    NodeCommand nodeCommand = NodeCommand.builder(mockProcessWrapper).script("script.js").build();
    assertThat(processStartArgument.getValue()).containsExactly("C:\\Windows\\System32\\where.exe", "$PATH:node.exe");
    nodeCommand.start();
    assertThat(processStartArgument.getValue()).containsExactly("C:\\Program Files\\node.exe", "script.js");
  }

  @Test
  void test_windows_default_node_not_found() throws Exception {
    when(mockProcessWrapper.isWindows()).thenReturn(true);
    when(mockProcessWrapper.startProcess(processStartArgument.capture(), any(), any(), any())).thenReturn(mock(Process.class));
    NodeCommandBuilder builder = NodeCommand.builder(mockProcessWrapper).script("script.js");
    assertThatThrownBy(builder::build)
      .isInstanceOf(NodeCommandException.class)
      .hasMessage("Node.js not found in PATH. PATH value was: null");
    assertThat(processStartArgument.getValue()).containsExactly("C:\\Windows\\System32\\where.exe", "$PATH:node.exe");
  }

  private static String resourceScript(String script) throws URISyntaxException {
    return new File(NodeCommandTest.class.getResource("/" + script).toURI()).getAbsolutePath();
  }

  private static BundlePathResolver getPathResolver() {
    File file = new File("src/test/resources");
    return (p) -> new File(file.getAbsoluteFile(), p).getAbsolutePath();
  }
}
