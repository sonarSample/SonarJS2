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
package org.sonar.plugins.javascript.utils;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.Deque;
import java.util.Iterator;
import java.util.NoSuchElementException;
import java.util.Spliterator;
import java.util.Spliterators;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;

public class PathWalker implements Iterator<Path> {

  private final Deque<Path> paths = new ArrayDeque<>();
  private final long rootDepth;
  private final int maxDepth;

  private PathWalker(Path root, int maxDepth) {
    this.rootDepth = depth(root);
    this.maxDepth = Math.max(0, maxDepth);
    addPath(root);
  }

  public static Stream<Path> stream(Path root, int maxDepth) {
    var pathWalker = new PathWalker(root, maxDepth);
    return StreamSupport.stream(Spliterators.spliteratorUnknownSize(pathWalker, Spliterator.ORDERED), false);
  }

  private static long depth(Path path) {
    return StreamSupport.stream(path.spliterator(), false).count();
  }

  @Override
  public boolean hasNext() {
    return !paths.isEmpty();
  }

  @Override
  public Path next() {
    if (!hasNext()) {
      throw new NoSuchElementException();
    }

    var path = paths.removeFirst();
    if (Files.isDirectory(path)) {
      Stream.ofNullable(path.toFile().listFiles())
        .flatMap(Arrays::stream)
        .map(File::toPath)
        .forEach(this::addPath);
    }
    return path;
  }

  private void addPath(Path path) {
    if (!Files.isSymbolicLink(path) && !isTooDeep(path)) {
      paths.addFirst(path);
    }
  }

  private boolean isTooDeep(Path path) {
    var pathDepth = depth(path);
    return pathDepth - rootDepth > maxDepth;
  }

}
