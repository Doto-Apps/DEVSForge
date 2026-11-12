import fs from "@zenfs/core";
import { frame, LSPFrames } from "./framing";

type ReadCallback = (error: Error | null, count?: number) => void;
const host = self as unknown as {
	Go: new () => {
		argv: string[];
		env: Record<string, string>;
		importObject: WebAssembly.Imports;
		run: (instance: WebAssembly.Instance) => Promise<void>;
	};
	fs: unknown;
	process: unknown;
};
let cwd = "/workspaces";
let input = new Uint8Array(0);
let reader:
	| {
			bytes: Uint8Array;
			offset: number;
			length: number;
			callback: ReadCallback;
	  }
	| undefined;
const frames = new LSPFrames();
let port: MessagePort;

function acceptInput(bytes: Uint8Array) {
	const combined = new Uint8Array(input.length + bytes.length);
	combined.set(input);
	combined.set(bytes, input.length);
	input = combined;
	if (reader && input.length) {
		const pending = reader;
		reader = undefined;
		const count = Math.min(input.length, pending.length);
		pending.bytes.set(input.subarray(0, count), pending.offset);
		input = input.slice(count);
		pending.callback(null, count);
	}
}

function files(values: Record<string, string>) {
	for (const [path, text] of Object.entries(values)) {
		if (!path.startsWith("/") || path.split("/").includes(".."))
			throw new Error("Invalid analysis path");
		fs.mkdirSync(path.slice(0, path.lastIndexOf("/")), { recursive: true });
		fs.writeFileSync(path, text);
	}
}

function stdio() {
	let directoryFD = 1000000;
	const directories = new Map<number, ReturnType<typeof fs.statSync>>();
	const write = (
		fd: number,
		buffer: Uint8Array,
		offset: number,
		length: number,
	) => {
		const bytes = buffer.subarray(offset, offset + length);
		if (fd === 1) frames.push(bytes, (message) => port.postMessage(message));
		else console.debug("gopls:", new TextDecoder().decode(bytes));
		return length;
	};
	host.fs = {
		...fs,
		close: (fd: number, callback: (error: unknown) => void) => {
			if (directories.delete(fd)) callback(null);
			else fs.close(fd, callback);
		},
		fstat: (fd: number, callback: (error: unknown, stat?: unknown) => void) => {
			const stat = directories.get(fd);
			if (stat) callback(null, stat);
			else fs.fstat(fd, callback);
		},
		// Node permits opening a directory for readdir/fstat; ZenFS does not.
		open: (
			path: string,
			flags: number,
			mode: number,
			callback: (error: unknown, fd?: number) => void,
		) => {
			try {
				const stat = fs.statSync(path);
				if (stat.isDirectory()) {
					const fd = directoryFD++;
					directories.set(fd, stat);
					callback(null, fd);
					return;
				}
			} catch {
				/* Delegate normal missing-file/create errors to ZenFS. */
			}
			fs.open(path, flags, mode, callback);
		},
		read: (
			fd: number,
			bytes: Uint8Array,
			offset: number,
			length: number,
			position: number,
			callback: ReadCallback,
		) => {
			if (fd !== 0)
				return fs.read(fd, bytes, offset, length, position, callback);
			reader = { bytes, callback, length, offset };
			acceptInput(new Uint8Array());
		},
		write: (
			fd: number,
			bytes: Uint8Array,
			offset: number,
			length: number,
			position: number,
			callback: ReadCallback,
		) => {
			if (fd > 2)
				return fs.write(fd, bytes, offset, length, position, callback);
			try {
				callback(null, write(fd, bytes, offset, length));
			} catch (error) {
				callback(error as Error);
			}
		},
		writeSync: (fd: number, bytes: Uint8Array) =>
			fd <= 2 ? write(fd, bytes, 0, bytes.length) : fs.writeSync(fd, bytes),
	};
	host.process = {
		chdir: (path: string) => {
			cwd = path;
		},
		cwd: () => cwd,
		getegid: () => 0,
		geteuid: () => 0,
		getgid: () => 0,
		getgroups: () => [],
		getuid: () => 0,
		pid: 1,
		ppid: 0,
		umask: () => 0o077,
	};
}

self.onmessage = async ({ data }) => {
	try {
		if (data.type === "boot") {
			port = data.port;
			port.onmessage = ({ data }) => acceptInput(frame(data));
			const response = await fetch("/language-tools/go/stdlib.json");
			if (!response.ok)
				throw new Error(
					"Go browser tools are missing. Run task front:language-tools.",
				);
			files(await response.json());
			files(data.files);
			for (const dir of [
				"/tmp",
				"/cache",
				"/gopath/pkg/mod",
				"/goroot/bin",
				"/workspaces",
			])
				fs.mkdirSync(dir, { recursive: true });
			// ZenFS allocates from descriptor zero; reserve standard streams so
			// a package/cache file can never be mistaken for the LSP input pipe.
			fs.mkdirSync("/dev", { recursive: true });
			for (const name of ["stdin", "stdout", "stderr"]) {
				fs.writeFileSync(`/dev/${name}`, "");
				fs.openSync(`/dev/${name}`, "r+");
			}
			fs.writeFileSync("/goroot/bin/go", "", { mode: 0o755 });
			stdio();
			// The Go runtime is a versioned static asset, not a Vite source module.
			const runtime = await fetch("/language-tools/go/wasm_exec.js");
			if (!runtime.ok) throw new Error("Go browser runtime is unavailable");
			const runtimeURL = URL.createObjectURL(
				new Blob([await runtime.text()], { type: "text/javascript" }),
			);
			try {
				await import(/* @vite-ignore */ runtimeURL);
			} finally {
				URL.revokeObjectURL(runtimeURL);
			}
			const go = new host.Go();
			go.argv = ["gopls"];
			go.env = {
				CGO_ENABLED: "0",
				GOARCH: "amd64",
				GOCACHE: "/cache",
				GOMODCACHE: "/gopath/pkg/mod",
				GOOS: "linux",
				GOPACKAGESDRIVER: "wasm",
				GOPATH: "/gopath",
				GOPROXY: "off",
				GOROOT: "/goroot",
				GOTOOLCHAIN: "local",
				GOVERSION: "go1.26.2",
				HOME: "/tmp",
				LSP_TRACE: data.trace ? "true" : "false",
				PATH: "/goroot/bin",
				TMPDIR: "/tmp",
			};
			const wasm = await fetch("/language-tools/go/gopls.wasm");
			if (!wasm.ok) throw new Error("Go WebAssembly engine is unavailable");
			const instance = await WebAssembly.instantiateStreaming(
				wasm,
				go.importObject,
			);
			void go
				.run(instance.instance)
				.catch((error) =>
					self.postMessage({ error: String(error), type: "error" }),
				);
			self.postMessage({ type: "ready" });
		} else if (data.type === "files") {
			files(data.files);
			self.postMessage({ id: data.id });
		} else if (data.type === "read") {
			self.postMessage({
				id: data.id,
				text: fs.readFileSync(data.path, "utf8"),
			});
		}
	} catch (error) {
		self.postMessage({ error: String(error), id: data.id, type: "error" });
	}
};
