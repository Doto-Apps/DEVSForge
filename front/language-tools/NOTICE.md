# Browser language tools

These tools are built from the pinned versions in `front/Dockerfile`,
`build-go.py` and `build-python.py`. They are not DEVSForge modeling libraries.
Modeling sources are loaded from the integration catalogue at runtime.

- Pyright: Microsoft Corporation, MIT; browser port by TypeFox and micro:bit.
  https://github.com/TypeFox/pyright/tree/browser
- typeshed: Python Software Foundation and contributors, MIT.
  https://github.com/python/typeshed
- Ruff: Astral Software Inc. and contributors, MIT.
  https://github.com/astral-sh/ruff
- Go and gopls: The Go Authors, BSD-3-Clause; browser changes by
  Better-Go-Playground. https://github.com/Better-Go-Playground/tools
- Go package driver: Better-Go-Playground, MIT.
  https://github.com/Better-Go-Playground/go-packages-driver-wasm
- ZenFS: James Prevett and contributors, LGPL-3.0-or-later.
  https://github.com/zen-fs/core
- Javacs: George Fraser and contributors, MIT. Its ReusableCompiler contains
  OpenJDK code under GPL-2.0 with the Classpath exception. The browser patch is
  provided in `java/browser.patch`; original notices remain in the source.
  https://github.com/georgewfraser/java-language-server
- Gson: Google Inc., Apache-2.0; Protocol Buffers: Google Inc., BSD-3-Clause.
  Their JARs include upstream notices.
- B-JVM: bjvm Authors, MIT. Built from source with the compatibility patch
  in `java/bjvm.patch`; the original MIT notice is shipped as LICENSE-bjvm.
  https://github.com/anematode/b-jvm
- OpenJDK 23.0.2+7 (Eclipse Temurin): GPL-2.0 with the Classpath exception
  and individual component notices, shipped in licenses-OpenJDK/.
  B-JVM's MIT licence does not replace the JDK's licence.
  https://adoptium.net/

Do not remove upstream copyright headers when updating or rebuilding these
dependencies. Rebuild and rerun the browser checks after changing a pin or patch.
