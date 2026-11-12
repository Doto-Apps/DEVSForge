#!/bin/sh
set -eu

# B-JVM supports Java 23 bytecode. Use a reproducible OpenJDK runtime rather
# than the upstream VM repository's test JDK binaries.
jlink --add-modules java.base,java.compiler,jdk.compiler,jdk.zipfs,java.logging,java.xml,jdk.unsupported \
  --output /tmp/java-runtime --strip-debug --no-header-files --no-man-pages
mkdir -p /output/java/jdk23/lib/security /output/java/jdk23/conf/security
cp /tmp/java-runtime/lib/modules /tmp/java-runtime/lib/tzdb.dat /output/java/jdk23/lib/
cp /tmp/java-runtime/lib/security/default.policy /output/java/jdk23/lib/security/
cp /tmp/java-runtime/conf/security/java.security /tmp/java-runtime/conf/security/java.policy /output/java/jdk23/conf/security/
# JUL's caller stack walker is not implemented in B-JVM. This disables console
# logging only; compiler diagnostics continue to travel over the LSP channel.
printf 'handlers=\n.level=OFF\n' > /output/java/jdk23/conf/logging.properties
cp -RL /tmp/java-runtime/legal /output/java/licenses-OpenJDK
jimage extract --dir /tmp/java-modules /tmp/java-runtime/lib/modules
mkdir /tmp/java-classes
for module in /tmp/java-modules/*; do
  rm -f "$module/module-info.class"
  cp -r "$module"/* /tmp/java-classes/
done
jar --create --file /output/java/jdk23.jar -C /tmp/java-classes .
