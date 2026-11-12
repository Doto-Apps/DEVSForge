#!/usr/bin/env python3
"""Build the pinned browser gopls and its in-process package loader.

The upstream browser port cannot spawn `go list`. Register the upstream
source-based package loader instead; no Go compiler or user code is executed.
All patches are applied to a disposable checkout, never to the Go workspace.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

TOOLS = "a969f2680150f191fcbc2c7538b05c4195681e27"
DRIVER = "5bd881e998ebc7362c9d045f861ccdc323b89888"


def run(*args, **kwargs):
    return subprocess.check_output(args, text=True, **kwargs).strip()


def checkout(url, revision, dest):
    run("git", "init", "-q", str(dest))
    run("git", "-C", str(dest), "fetch", "-q", "--depth", "1", url, revision)
    run("git", "-C", str(dest), "checkout", "-q", "FETCH_HEAD")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    env = {**os.environ, "GOWORK": "off", "GOTOOLCHAIN": "go1.26.2"}
    with tempfile.TemporaryDirectory(prefix="devsforge-gopls-") as temp:
        root = Path(temp)
        tools, driver = root / "tools", root / "driver"
        checkout("https://github.com/Better-Go-Playground/tools", TOOLS, tools)
        checkout("https://github.com/Better-Go-Playground/go-packages-driver-wasm", DRIVER, driver)
        target = tools / "gopls/internal/browserdriver"
        shutil.copytree(driver / "internal/driver", target)
        shutil.copyfile(driver / "LICENSE", target / "LICENSE")
        # DEVSForge's local modules have no public proxy path. Extend the
        # upstream loader with local replacements instead of rewriting imports.
        files = target / "loader_files.go"
        text = files.read_text()
        needle = "for _, gp := range rt.gopath {"
        start = text.index("func (rt *loaderRuntime) resolveImport(importPath, srcDir string)")
        text = text[:start] + text[start:].replace(needle, '''if replaced, err := rt.browserReplacement(importPath, srcDir); err != nil {
        return "", "", nil, err
    } else if replaced != nil {
        return replaced.dir, replaced.pkgID, replaced.mod, nil
    }
    ''' + needle, 1)
        text += '''
func (rt *loaderRuntime) browserReplacement(importPath, srcDir string) (*resolvedImport, error) {
    modules := []*moduleInfo{rt.mainModule}
    if module, err := rt.moduleForDir(srcDir); err == nil { modules = append(modules, module) }
    for _, module := range modules {
        if module == nil { continue }
        bytes, err := os.ReadFile(module.GoModPath)
        if err != nil { return nil, err }
        manifest, err := modfile.Parse(module.GoModPath, bytes, nil)
        if err != nil { return nil, err }
        for _, replace := range manifest.Replace {
            if replace.New.Version != "" || (importPath != replace.Old.Path && !strings.HasPrefix(importPath, replace.Old.Path+"/")) { continue }
            root := replace.New.Path
            if !filepath.IsAbs(root) { root = filepath.Join(module.Dir, root) }
            dir := filepath.Join(root, strings.TrimPrefix(strings.TrimPrefix(importPath, replace.Old.Path), "/"))
            if dirExists(dir) {
                replaced := &moduleInfo{Path: replace.Old.Path, Dir: root, GoModPath: filepath.Join(root, "go.mod")}
                return &resolvedImport{dir: dir, pkgID: importPath, mod: replaced.toPackageModule()}, nil
            }
        }
    }
    return nil, nil
}
'''
        files.write_text(text)
        external = tools / "go/packages/external_wasm.go"
        external.write_text('''package packages

// BrowserDriver is registered by the browser entry point. It resolves packages
// from the browser file system instead of launching an external command.
var BrowserDriver func(*Config, []string) (*DriverResponse, error)

func buildDriver(tool string) driver {
    if tool == "wasm" { return BrowserDriver }
    return nil
}
''')
        entry = tools / "gopls/main_wasm.go"
        code = entry.read_text().replace('"context"', '''"context"
    "encoding/json"
    "golang.org/x/tools/go/packages"
    browserdriver "golang.org/x/tools/gopls/internal/browserdriver"''')
        code = code.replace("func main() {", '''func main() {
    packages.BrowserDriver = func(cfg *packages.Config, patterns []string) (*packages.DriverResponse, error) {
        config := browserdriver.ConfigFromDriverRequest(
            browserdriver.GoVersion{GoMinorVersion: 26, Compiler: "gc", Arch: "amd64"},
            cfg.Dir, packages.DriverRequest{Mode: cfg.Mode, Env: cfg.Env,
                BuildFlags: cfg.BuildFlags, Tests: cfg.Tests, Overlay: cfg.Overlay})
        result, err := browserdriver.NewLoader(config).Load(cfg.Context, patterns)
        if os.Getenv("LSP_TRACE") == "true" { encoded, _ := json.Marshal(result); log.Printf("browser packages %s: %s", cfg.Dir, encoded) }
        return result, err
    }
''')
        entry.write_text(code)
        cache = tools / "gopls/internal/filecache/filecache.go"
        code = cache.read_text()
        needle = "func hashExecutable() (hash [32]byte, err error) {"
        if needle not in code:
            raise RuntimeError("gopls cache implementation changed; review the browser patch")
        # There is no os.Executable in js/wasm. Each worker has its own volatile
        # cache, so hashing the pinned source identity safely versions that cache.
        code = code.replace(needle, needle + '\n return sha256.Sum256([]byte("' + TOOLS + DRIVER + '")), nil\n}\n\nfunc unusedNativeHashExecutable() (hash [32]byte, err error) {')
        cache.write_text(code)
        run("go", "build", "-trimpath", "-ldflags=-s -w", "-o", str(output / "gopls.wasm"), ".",
            cwd=tools / "gopls", env={**env, "GOOS": "js", "GOARCH": "wasm", "CGO_ENABLED": "0"})
        goroot = Path(run("go", "env", "GOROOT", env=env))
        shutil.copyfile(goroot / "lib/wasm/wasm_exec.js", output / "wasm_exec.js")
        # Analysis reads source files. Shipping SDK binaries is unnecessary.
        files = {"/goroot/" + p.relative_to(goroot).as_posix(): p.read_text()
                 for p in (goroot / "src").rglob("*")
                 if p.is_file() and p.suffix in (".go", ".s", ".h", ".mod")
                 and "testdata" not in p.parts and "cmd" not in p.relative_to(goroot / "src").parts
                 and not p.name.endswith("_test.go")}
        (output / "stdlib.json").write_text(json.dumps(files, separators=(",", ":")))
        shutil.copyfile(tools / "LICENSE", output / "LICENSE-gopls")
        shutil.copyfile(driver / "LICENSE", output / "LICENSE-package-driver")
        shutil.copyfile(goroot / "LICENSE", output / "LICENSE-go")


if __name__ == "__main__":
    main()
