---
title: Tools
description: What are the tools that you can use
---

# Whats the tools

## Front

- `biome`: Format the `front` code. You can find the biome config in `biome.json`
- `pnpm`: An efficient package manager

### How to have the good pnpm version

Use corepack with `corepack enable`

### Run format

`pnpm run format:front`


## Git hooks

The project use `lefthooks` to handle git hooks
- `commit-msg`: Your commit message must follow conventional commit : https://www.conventionalcommits.org/en/v1.0.0/
- `pre-commit`: It will :
  - format `back` with `go fmt`
  - foramt `front` with `biome`

### Force commit

**Warning: It will skip formatting too and not only commit lint**.
```
  git commit -m "fix: toto" --no-verify
```
