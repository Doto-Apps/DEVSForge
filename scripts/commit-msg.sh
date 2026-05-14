#!/bin/bash

# Regex to validate the type pattern
REGEX="^((Merge[ a-z-]* branch.*)|(Revert*)|((build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\(.*\))?!?: .*))"

FIRST_LINE=$(head -n 1 "$1")

echo "Commit Message: ${FIRST_LINE}"

if ! [[ $FIRST_LINE =~ $REGEX ]]; then
    echo >&2 "ERROR: Commit aborted for not following the Conventional Commit standard."
    exit 1
else
    echo >&2 "Valid commit message."
fi

