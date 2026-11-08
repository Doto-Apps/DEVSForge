#!/bin/sh
set -eu
integration=${1:?Usage: task simulator:proto -- xdevs-go}
case "$integration" in *[!a-z0-9-]*|'') echo 'Invalid integration identifier' >&2; exit 1;; esac
script="simulator/runner/integrations/$integration/generate-proto.sh"
test -f "$script" || { echo 'Integration has no protocol generator' >&2; exit 1; }
exec sh "$script"
