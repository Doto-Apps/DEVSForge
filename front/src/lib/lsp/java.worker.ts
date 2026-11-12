// One local B-JVM per workspace; Javacs indexes are isolated by class loader.
// The filesystem is ephemeral. Terminating this worker frees the whole VM.
import { LSPFrames } from "./framing";

type Bridge = {
	create(id: string, classPath: string): Promise<void>;
	send(id: string, encoded: string): Promise<void>;
	drain(id: string): Promise<string>;
	close(id: string): Promise<void>;
};
type Filesystem = {
	mkdir(path: string): void;
	writeFile(path: string, bytes: Uint8Array): void;
	readFile(path: string, options: { encoding: "utf8" }): string;
	readdir(path: string): string[];
	stat(path: string): { mode: number };
	unlink(path: string): void;
	rmdir(path: string): void;
};
type Runtime = {
	makeBovineOS(options: {
		runtimeUrl: string;
		wasmLocation: string;
		additionalRuntimeFiles: string[];
		stdout(bytes: Uint8Array): void;
		stderr(bytes: Uint8Array): void;
	}): Promise<{
		FS: Filesystem;
		makeVM(options: { classpath: string; heapSize: number }): {
			loadClass(name: string): Bridge;
		};
	}>;
};
const projects = new Map<string, { port: MessagePort; frames: LSPFrames }>();
let bridge: Bridge;
let filesystem: Filesystem;
let root: string;
let classPath: string;
let booted = false;
let serial: Promise<unknown> = Promise.resolve();
const schedule = <T>(work: () => Promise<T>) => {
	const result = serial.then(work);
	serial = result.catch(() => undefined);
	return result;
};
async function errorMessage(error: unknown): Promise<string> {
	try {
		return String(error);
	} catch {
		try {
			return await (error as { toString(): Promise<string> }).toString();
		} catch {
			return "Java browser engine failed";
		}
	}
}
function projectPath(path: string) {
	if (!path.startsWith(`${root}/projects/`) || path.split("/").includes(".."))
		throw new Error("Invalid Java project path");
	return path;
}
function write(path: string, text: string) {
	projectPath(path);
	let directory = "";
	for (const part of path.split("/").slice(1, -1)) {
		directory += `/${part}`;
		try {
			filesystem.mkdir(directory);
		} catch {
			if ((filesystem.stat(directory).mode & 0xf000) !== 0x4000)
				throw new Error(`Cannot create Java directory: ${directory}`);
		}
	}
	filesystem.writeFile(path, new TextEncoder().encode(text));
}
function remove(path: string) {
	projectPath(path);
	for (const entry of filesystem.readdir(path)) {
		if (entry === "." || entry === "..") continue;
		const child = `${path}/${entry}`;
		if ((filesystem.stat(child).mode & 0xf000) === 0x4000) remove(child);
		else filesystem.unlink(child);
	}
	filesystem.rmdir(path);
}
async function boot() {
	const base = "/language-tools/java";
	const script = await fetch(`${base}/runtime.js`);
	if (!script.ok)
		throw new Error(
			"Java browser runtime is missing. Run task front:language-tools.",
		);
	const runtimeURL = URL.createObjectURL(
		new Blob([await script.text()], { type: "text/javascript" }),
	);
	let runtimeModule: Runtime;
	try {
		runtimeModule = (await import(/* @vite-ignore */ runtimeURL)) as Runtime;
	} finally {
		URL.revokeObjectURL(runtimeURL);
	}
	const { makeBovineOS } = runtimeModule;
	const response = await fetch(`${base}/jars.json`);
	if (!response.ok)
		throw new Error(
			"Java browser tools are missing. Run task front:language-tools.",
		);
	const jars = (await response.json()) as string[];
	classPath = jars.map((name) => `/${name}`).join(":");
	const runtime = await makeBovineOS({
		additionalRuntimeFiles: [
			"bridge.jar",
			"jdk23/lib/tzdb.dat",
			"jdk23/conf/logging.properties",
			...jars,
		],
		runtimeUrl: base,
		stderr: (bytes) => console.warn(new TextDecoder().decode(bytes)),
		stdout: (bytes) => console.debug(new TextDecoder().decode(bytes)),
		wasmLocation: `${base}/bjvm_main.wasm`,
	});
	filesystem = runtime.FS;
	const vm = runtime.makeVM({
		classpath: "/bridge.jar",
		heapSize: 256 * 1024 * 1024,
	});
	bridge = vm.loadClass("devsforge/browser/BrowserBridge");
}
function encode(message: unknown) {
	const bytes = new TextEncoder().encode(JSON.stringify(message));
	let binary = "";
	for (let offset = 0; offset < bytes.length; offset += 8192)
		binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
	return btoa(binary);
}
async function poll() {
	for (;;) {
		for (const [id, project] of projects) {
			try {
				const chunk = await schedule(() => bridge.drain(id));
				if (chunk)
					project.frames.push(
						Uint8Array.from(atob(chunk), (char) => char.charCodeAt(0)),
						(message) => project.port.postMessage(message),
					);
			} catch (error) {
				self.postMessage({
					error: await errorMessage(error),
					project: id,
					type: "error",
				});
				projects.delete(id);
			}
		}
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
}
self.onmessage = ({ data }) => {
	void schedule(async () => {
		try {
			if (data.type === "boot" && !booted) {
				booted = true;
				root = data.root;
				if (!/^\/workspaces\/devsforge-[a-f0-9-]{36}$/.test(root))
					throw new Error("Invalid Java workspace root");
				await boot();
				self.postMessage({ type: "ready" });
				void poll();
				return;
			}
			if (data.type === "files") {
				for (const [path, text] of Object.entries(
					data.files as Record<string, string>,
				))
					write(path, text);
			} else if (data.type === "create") {
				await bridge.create(data.project, classPath);
				const project = {
					frames: new LSPFrames(),
					port: data.port as MessagePort,
				};
				projects.set(data.project, project);
				project.port.onmessage = ({ data: message }) => {
					void schedule(() => bridge.send(data.project, encode(message))).catch(
						async (error) =>
							self.postMessage({
								error: await errorMessage(error),
								project: data.project,
								type: "error",
							}),
					);
				};
			} else if (data.type === "read") {
				self.postMessage({
					id: data.id,
					text: filesystem.readFile(projectPath(data.path), {
						encoding: "utf8",
					}),
				});
				return;
			} else if (data.type === "close") {
				projects.get(data.project)?.port.close();
				projects.delete(data.project);
				await bridge.close(data.project);
				remove(data.root);
			} else throw new Error("Unknown Java worker command");
			self.postMessage({ id: data.id });
		} catch (error) {
			self.postMessage({
				error: await errorMessage(error),
				id: data.id,
				type: "error",
			});
		}
	});
};
