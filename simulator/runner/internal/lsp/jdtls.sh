#!/bin/sh
set -eu
launcher=$(find /opt/lsp/jdtls/plugins -name 'org.eclipse.equinox.launcher_*.jar' -print -quit)
configuration=config_linux
case "$(uname -m)" in aarch64|arm64) configuration=config_linux_arm;; esac
# Equinox extracts native files and writes configuration state. Keep that state private.
mkdir -p "$PWD/.jdtls-config"
cp "/opt/lsp/jdtls/$configuration/config.ini" "$PWD/.jdtls-config/config.ini"
exec /opt/lsp/jdk25/bin/java -Xms64m -Xmx768m \
 -Dosgi.install.area=/opt/lsp/jdtls \
 -Declipse.application=org.eclipse.jdt.ls.core.id1 -Dosgi.bundles.defaultStartLevel=4 \
 -Declipse.product=org.eclipse.jdt.ls.core.product \
 --add-modules=ALL-SYSTEM --add-opens java.base/java.util=ALL-UNNAMED --add-opens java.base/java.lang=ALL-UNNAMED \
 -jar "$launcher" -configuration "$PWD/.jdtls-config" "$@"
