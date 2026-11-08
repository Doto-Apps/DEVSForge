import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { v4 as uuid } from "uuid";
import { client } from "@/api/client";
import { useAuth } from "@/providers/AuthProvider";
import { reactflowToModel } from "@/lib/reactflowToModel";
import type { ReactFlowInput } from "@/types";

type Tab = {
	id: string;
	libraryId: string;
	libraryName: string;
	name: string;
	kind: string;
	integration?: string;
	draft: ReactFlowInput;
	baseline: string;
	past: ReactFlowInput[];
	future: ReactFlowInput[];
};
type Snapshot = { tabs: Tab[]; drafts: Record<string, unknown> };
type Workbench = {
	id: string;
	ready: boolean;
	tabs: Tab[];
	open: (tab: Omit<Tab, "baseline" | "past" | "future">) => void;
	update: (id: string, graph: ReactFlowInput, checkpoint?: boolean) => void;
	undo: (id: string, redo?: boolean) => void;
	save: (id: string) => Promise<void>;
	remove: (id: string) => void;
	reorder: (id: string, targetId: string, after: boolean) => void;
	dirty: (tab: Tab) => boolean;
	drafts: Record<string, unknown>;
	setDraft: (key: string, value: unknown) => void;
	storageError: string | undefined;
};
const Context = createContext<Workbench | undefined>(undefined);
const signature = (graph: ReactFlowInput) =>
	JSON.stringify({
		...graph,
		viewport: undefined,
		nodes: graph.nodes.map(({ selected, dragging, ...node }) => node),
	});
// Nested models are read-only references. Refresh their colors without replacing
// the tab's draft, layout, selection or undo history with the server snapshot.
export function refreshTabColors(tab: Tab, incoming: ReactFlowInput): Tab {
	const sources = new Map(incoming.nodes.map((node) => [node.id, node]));
	const refresh = (graph: ReactFlowInput): ReactFlowInput => {
		let changed = false;
		const nodes = graph.nodes.map((node) => {
			const source = sources.get(node.id);
			if (!node.parentId || !source || source.data.id !== node.data.id)
				return node;
			const colors = source.data.reactFlowModelGraphicalData;
			if (
				JSON.stringify(colors) ===
				JSON.stringify(node.data.reactFlowModelGraphicalData)
			)
				return node;
			changed = true;
			return {
				...node,
				data: { ...node.data, reactFlowModelGraphicalData: colors },
			};
		});
		return changed ? { ...graph, nodes } : graph;
	};
	const draft = refresh(tab.draft);
	const baseline = signature(refresh(JSON.parse(tab.baseline)));
	const past = tab.past.map(refresh);
	const future = tab.future.map(refresh);
	if (
		draft === tab.draft &&
		baseline === tab.baseline &&
		past.every((graph, i) => graph === tab.past[i]) &&
		future.every((graph, i) => graph === tab.future[i])
	)
		return tab;
	return { ...tab, baseline, draft, future, past };
}

function database(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const r = indexedDB.open("devsforge-workbench", 1);
		r.onupgradeneeded = () => r.result.createObjectStore("workspaces");
		r.onsuccess = () => resolve(r.result);
		r.onerror = () => reject(r.error);
	});
}
async function read(key: string): Promise<Snapshot | undefined> {
	const db = await database();
	try {
		return await new Promise((resolve, reject) => {
			const r = db.transaction("workspaces").objectStore("workspaces").get(key);
			r.onsuccess = () => resolve(r.result);
			r.onerror = () => reject(r.error);
		});
	} finally {
		db.close();
	}
}
async function write(key: string, value: Snapshot) {
	const db = await database();
	try {
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction("workspaces", "readwrite");
			tx.objectStore("workspaces").put(value, key);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	} finally {
		db.close();
	}
}
export function WorkbenchProvider({ children }: { children: ReactNode }) {
	const { user } = useAuth();
	const account = user?.email ?? "";
	const [id] = useState(() => uuid());
	const [ready, setReady] = useState(false);
	const [snapshot, setSnapshot] = useState<Snapshot>({ tabs: [], drafts: {} });
	const state = useRef(snapshot);
	state.current = snapshot;
	const [storageError, setStorageError] = useState<string>();
	const recent = useRef<Record<string, number>>({});
	const epoch = useRef(0);
	const key = `${account}:${id}`;
	useEffect(() => {
		if (!account) return;
		const generation = ++epoch.current;
		let active = true;
		const pointer = `devsforge-workbench:${account}`;
		const previous = sessionStorage.getItem(pointer);
		setReady(false);
		setSnapshot({ tabs: [], drafts: {} });
		(async () => {
			// Let StrictMode finish its rehearsal before publishing the recovery pointer.
			await Promise.resolve();
			if (!active) return;
			try {
				const emergency = previous
					? sessionStorage.getItem(`recovery:${previous}`)
					: null;
				const stored = emergency
					? JSON.parse(emergency)
					: previous
						? await read(previous)
						: undefined;
				if (active && stored) setSnapshot(stored);
			} catch {
				if (active)
					setStorageError(
						"Local recovery is unavailable. Keep this page open until your changes are saved.",
					);
			} finally {
				if (active) {
					sessionStorage.setItem(pointer, key);
					setReady(true);
				}
			}
		})();
		const preloadEditor = () => {
			performance.mark("devsforge:editor-preload");
			void import("@/lib/lsp/client")
				.then((m) => m.initializeEditor())
				.then(() => {
					performance.mark("devsforge:editor-ready");
					performance.measure(
						"devsforge:editor-preload",
						"devsforge:editor-preload",
						"devsforge:editor-ready",
					);
				})
				.catch(() => undefined);
		};
		const idle = typeof requestIdleCallback === "function";
		const preload = idle
			? requestIdleCallback(preloadEditor, { timeout: 2000 })
			: window.setTimeout(preloadEditor, 500);

		return () => {
			active = false;
			if (idle) cancelIdleCallback(preload);
			else clearTimeout(preload);
			void import("@/lib/lsp/client").then((m) => {
				if (epoch.current === generation) return m.closeWorkbench(id);
			});
		};
	}, [account, id, key]);
	useEffect(() => {
		if (!ready || !account) return;
		const persisted = {
			tabs: snapshot.tabs.map((t) => ({ ...t, past: [], future: [] })),
			drafts: snapshot.drafts,
		};
		void write(key, persisted).catch(() =>
			setStorageError(
				"Local recovery failed. Save your changes before closing this page.",
			),
		);
		const flush = () => {
			try {
				sessionStorage.setItem(`recovery:${key}`, JSON.stringify(persisted));
			} catch {
				setStorageError("Local recovery storage is full.");
			}
		};
		window.addEventListener("pagehide", flush);
		return () => window.removeEventListener("pagehide", flush);
	}, [snapshot, ready, key, account]);
	const change = useCallback(
		(fn: (s: Snapshot) => Snapshot) => setSnapshot((s) => fn(s)),
		[],
	);
	const open = useCallback(
		(tab: Omit<Tab, "baseline" | "past" | "future">) => {
			if (!ready) return;
			change((s) =>
				s.tabs.some((t) => t.id === tab.id)
					? {
							...s,
							tabs: s.tabs.map((t) => {
								if (t.id !== tab.id) return t;
								const refreshed = refreshTabColors(t, tab.draft);
								return refreshed.libraryName !== tab.libraryName
									? { ...refreshed, libraryName: tab.libraryName }
									: refreshed;
							}),
						}
					: {
							...s,
							tabs: [
								...s.tabs,
								{
									...tab,
									baseline: signature(tab.draft),
									past: [],
									future: [],
								},
							],
						},
			);
		},
		[ready, change],
	);
	const update = useCallback(
		(tabId: string, graph: ReactFlowInput, checkpoint = false) => {
			const now = Date.now();
			const push = checkpoint || now - (recent.current[tabId] ?? 0) > 500;
			recent.current[tabId] = now;
			change((s) => ({
				...s,
				tabs: s.tabs.map((t) =>
					t.id !== tabId
						? t
						: {
								...t,
								name:
									graph.nodes.find((n) => n.id === tabId)?.data.label ?? t.name,
								draft: graph,
								past:
									signature(graph) !== signature(t.draft) && push
										? [...t.past, t.draft].slice(-100)
										: t.past,
								future: signature(graph) === signature(t.draft) ? t.future : [],
							},
				),
			}));
		},
		[change],
	);
	const undo = useCallback(
		(tabId: string, redo = false) =>
			change((s) => ({
				...s,
				tabs: s.tabs.map((t) => {
					if (t.id !== tabId) return t;
					const source = redo ? t.future : t.past;
					if (!source.length) return t;
					const next = source[source.length - 1];
					return {
						...t,
						draft: next,
						past: redo ? [...t.past, t.draft] : t.past.slice(0, -1),
						future: redo ? t.future.slice(0, -1) : [...t.future, t.draft],
					};
				}),
			})),
		[change],
	);
	const save = useCallback(
		async (tabId: string) => {
			const tab = state.current.tabs.find((t) => t.id === tabId);
			if (!tab) throw new Error("Model is not open");
			const sent = tab.draft;
			const body = reactflowToModel(sent).find((m) => m.id === tabId);
			if (!body) throw new Error("Model not found in diagram");
			const { data, error } = await client.PATCH("/model/{id}", {
				params: { path: { id: tabId } },
				body,
			});
			if (error || !data)
				throw new Error(
					typeof error === "object" && error && "error" in error
						? String(error.error)
						: "Model could not be saved",
				);
			change((s) => ({
				...s,
				tabs: s.tabs.map((t) => {
					const refreshed = refreshTabColors(t, {
						...t.draft,
						nodes: t.draft.nodes.map((node) =>
							node.parentId && node.data.id === tabId
								? {
										...node,
										data: {
											...node.data,
											reactFlowModelGraphicalData: data.metadata.modelColors,
										},
									}
								: node,
						),
					});
					return t.id === tabId
						? { ...refreshed, baseline: signature(sent) }
						: refreshed;
				}),
			}));
		},
		[change],
	);
	const remove = useCallback(
		(tabId: string) => {
			change((s) => ({ ...s, tabs: s.tabs.filter((t) => t.id !== tabId) }));
			void import("@/lib/lsp/client").then((m) =>
				m.closeEditorDocument(id, tabId),
			);
		},
		[id, change],
	);
	const setDraft = useCallback(
		(name: string, value: unknown) =>
			change((s) => ({
				...s,
				drafts: {
					...s.drafts,
					[name]: typeof value === "function" ? value(s.drafts[name]) : value,
				},
			})),
		[change],
	);
	const reorder = useCallback(
		(tabId: string, targetId: string, after: boolean) => {
			change((s) => {
				const tab = s.tabs.find((t) => t.id === tabId);
				if (
					!tab ||
					tabId === targetId ||
					!s.tabs.some((t) => t.id === targetId)
				)
					return s;
				const tabs = s.tabs.filter((t) => t.id !== tabId);
				const index = tabs.findIndex((t) => t.id === targetId);
				tabs.splice(index + (after ? 1 : 0), 0, tab);
				return { ...s, tabs };
			});
		},
		[change],
	);
	return (
		<Context.Provider
			value={{
				id,
				ready,
				tabs: snapshot.tabs,
				open,
				update,
				undo,
				save,
				remove,
				reorder,
				dirty: (t) => signature(t.draft) !== t.baseline,
				drafts: snapshot.drafts,
				setDraft,
				storageError,
			}}
		>
			{children}
		</Context.Provider>
	);
}
export const useWorkbench = () => {
	const value = useContext(Context);
	if (!value) throw new Error("WorkbenchProvider is missing");
	return value;
};
export const useOptionalWorkbench = () => useContext(Context);

export function useWorkbenchState<T>(
	key: string,
	initial: T,
): [T, (value: T | ((old: T) => T)) => void] {
	const w = useWorkbench();
	const first = useRef(initial);
	const value = (w.drafts[key] ?? first.current) as T;
	const set = useCallback(
		(next: T | ((old: T) => T)) =>
			w.setDraft(key, (old: unknown) =>
				typeof next === "function"
					? (next as (v: T) => T)((old ?? first.current) as T)
					: next,
			),
		[w.setDraft, key],
	);
	return [value, set];
}
