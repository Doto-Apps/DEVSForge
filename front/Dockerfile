FROM --platform=$BUILDPLATFORM golang:1.26.2 AS go-tools
RUN apt-get update && apt-get install -y --no-install-recommends python3 git && rm -rf /var/lib/apt/lists/*
COPY front/language-tools/build-go.py /build-go.py
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build python3 /build-go.py /output/go

FROM --platform=$BUILDPLATFORM python:3.12-slim AS python-tools
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
COPY front/language-tools/build-python.py /build-python.py
RUN python3 /build-python.py /output/python

FROM --platform=$BUILDPLATFORM emscripten/emsdk:4.0.2@sha256:8de4dcc50c6591b217222344c1c76113baa2a3f3a5148e8d98d719b2393599ab AS java-vm
ARG BJVM_REVISION=3fd56c74656602eb32efefca46f51f074bef6bca
RUN git init /bjvm && cd /bjvm && git fetch --depth 1 https://github.com/anematode/b-jvm "$BJVM_REVISION" && git checkout FETCH_HEAD
COPY front/language-tools/java/bjvm.patch /bjvm.patch
WORKDIR /bjvm
RUN git apply /bjvm.patch && sed -i '/include(Doctest)/d;s/--emit-tsd bjvm_main.d.ts//' CMakeLists.txt
ENV PATH="/emsdk/node/20.18.0_64bit/bin:${PATH}"
RUN emcmake cmake -G "Unix Makefiles" -S /bjvm -B /build-vm -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=OFF -DENABLE_LTO=OFF -DDCHECKS_ENABLED=ON && \
    cmake --build /build-vm --target bjvm_main -j4
RUN mkdir -p /output/java && cp /build-vm/bjvm_main.wasm /output/java/ && cp /build-vm/bjvm_main.js build/bjvm_main.js && cp LICENSE /output/java/LICENSE-bjvm && \
    npm exec --yes --package=esbuild@0.25.12 -- esbuild js/bjvm2.ts --bundle --format=esm --outfile=/output/java/runtime.js

FROM --platform=$BUILDPLATFORM eclipse-temurin:23-jdk@sha256:83177670e43c17769a5402a60601545318e45e63adf634fb5022340e516cded4 AS java-tools
RUN apt-get update && apt-get install -y --no-install-recommends git maven && rm -rf /var/lib/apt/lists/*
ARG JAVACS_REVISION=58daaa29a0e2fe22764283607da6801cf8b493b9
RUN git init /javacs && cd /javacs && git fetch --depth 1 https://github.com/georgewfraser/java-language-server "$JAVACS_REVISION" && git checkout FETCH_HEAD
COPY front/language-tools/java/browser.patch /browser.patch
RUN cd /javacs && git apply /browser.patch
RUN --mount=type=cache,target=/root/.m2 cd /javacs && mvn -q -Dmaven.test.skip=true -Denforcer.skip=true package
COPY front/language-tools/java/BrowserBridge.java /bridge/BrowserBridge.java
RUN mkdir -p /output/java && javac -d /bridge/classes /bridge/BrowserBridge.java && jar --create --file /output/java/bridge.jar -C /bridge/classes . && \
    cp /javacs/dist/classpath/*.jar /output/java/ && cp /javacs/LICENSE.md /output/java/LICENSE-javacs && \
    printf '["java-language-server.jar","gson-2.8.9.jar","protobuf-java-3.25.5.jar"]\n' > /output/java/jars.json
COPY front/language-tools/java/build-runtime.sh /build-runtime.sh
RUN sh /build-runtime.sh

# Static files only: this target starts no daemon and exposes no port.
FROM scratch AS language-tools
COPY --from=go-tools /output/ /
COPY --from=python-tools /output/ /
COPY --from=java-tools /output/ /
COPY --from=java-vm /output/ /
COPY front/language-tools/NOTICE.md /NOTICE.md

FROM --platform=$BUILDPLATFORM node:24-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY front/package.json front/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

ENV VITE_API_BASE_URL=http://localhost:3000/

COPY front/ .
COPY --from=language-tools / /app/public/language-tools/
RUN cp node_modules/@typefox/pyright-browser/LICENSE.txt public/language-tools/python/LICENSE-pyright && \
    cp node_modules/@typefox/pyright-browser/dist/pyright.worker.js.LICENSE.txt public/language-tools/python/NOTICE-pyright-worker && \
    cp node_modules/@astral-sh/ruff-wasm-web/LICENSE public/language-tools/LICENSE-ruff && \
    cp node_modules/@zenfs/core/LICENSE.md public/language-tools/LICENSE-zenfs && \
    cp node_modules/@zenfs/core/COPYING.md public/language-tools/COPYING-zenfs && \
    cp language-tools/NOTICE.md public/language-tools/NOTICE.md
RUN pnpm run build

FROM nginx:stable-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY front/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

VOLUME [ "/etc/nginx/conf.d" ]

CMD ["nginx", "-g", "daemon off;"]
