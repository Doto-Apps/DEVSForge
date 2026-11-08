import { useRef, useState } from "react";
import { Dictation } from "@/components/custom/Dictation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
	mergeStructureProposal,
	validateGeneratedStructure,
} from "@/lib/llmToReactFlow";
import { useWorkbenchState } from "@/providers/WorkbenchProvider";
import type { GeneratedDiagram } from "@/types";

type Message = { role: "user" | "assistant"; content: string };
export function structureContext(
	diagram: GeneratedDiagram,
	codeIds: string[] = [],
) {
	return JSON.stringify({
		connections: diagram.connections,
		models: diagram.models.map((m) => ({
			components: m.components ?? [],
			id: m.id,
			name: m.name,
			ports: [
				...m.ports.in.map((name) => ({ id: name, name, type: "in" })),
				...m.ports.out.map((name) => ({ id: name, name, type: "out" })),
			],
			role: m.role,
			type: m.type,
			...(codeIds.includes(m.id) ? { code: m.code } : {}),
		})),
		modelUnderTestId: diagram.modelUnderTestId,
		name: diagram.name,
		rootModelId: diagram.rootModelId,
	});
}
export function StructureConversation({
	conversationKey,
	initialPrompt,
	diagram,
	onChange,
	onGenerate,
	errorMessage,
}: {
	conversationKey: string;
	initialPrompt: string;
	diagram: GeneratedDiagram;
	onChange: (d: GeneratedDiagram) => void;
	onGenerate: (
		text: string,
		past: Message[],
	) => Promise<GeneratedDiagram | null>;
	errorMessage?: string | null;
}) {
	const [history, setHistory] = useWorkbenchState<Message[]>(
		`${conversationKey}:history`,
		[],
	);
	const [proposal, setProposal] = useWorkbenchState<GeneratedDiagram | null>(
		`${conversationKey}:proposal`,
		null,
	);
	const [base, setBase] = useWorkbenchState(`${conversationKey}:base`, "");
	const [text, setText] = useWorkbenchState(`${conversationKey}:input`, "");
	const [codeIds, setCodeIds] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const latest = useRef(diagram);
	latest.current = diagram;
	const issues = proposal
		? [
				...new Set([
					...(proposal.validationErrors ?? []),
					...validateGeneratedStructure(proposal),
				]),
			]
		: [];
	const changed = !!proposal && !!base && base !== structureContext(diagram);
	const request = async () => {
		if (!text.trim() || busy) return;
		setBusy(true);
		setError("");
		const sent = structureContext(latest.current);
		setBase(sent);
		const question = text;
		try {
			const prompt = `[INITIAL REQUEST]\n${initialPrompt}\n[CURRENT STRUCTURE]\n${structureContext(latest.current, codeIds)}\n[REQUESTED CHANGE]\n${question}`;
			const messages: Message[] = [
				{ content: initialPrompt, role: "user" },
				...history.slice(-6),
			];
			if (
				new Blob([
					JSON.stringify({ pastMessages: messages, userPrompt: prompt }),
				]).size >
				250 * 1024
			)
				throw new Error(
					"Conversation is too large. Remove attached code or start a new conversation. The current structure was kept.",
				);
			const result = await onGenerate(prompt, messages);
			if (!result)
				throw new Error(
					"The AI could not return a proposal. Your current structure is unchanged.",
				);
			setProposal(result);
			setHistory([
				...history,
				{ content: question, role: "user" },
				{ content: structureContext(result), role: "assistant" },
			]);
			setText("");
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	};
	return (
		<aside className="flex min-h-0 max-h-80 w-full shrink-0 flex-col border-t bg-background lg:max-h-none lg:w-64 lg:border-l lg:border-t-0 xl:w-72">
			<div className="p-3 border-b">
				<h3 className="font-semibold">Discuss structure</h3>
				<p className="text-xs text-muted-foreground">
					Corrections are proposed before they replace your diagram.
				</p>
			</div>
			<div className="flex-1 overflow-auto p-3 space-y-3">
				<div className="text-sm whitespace-pre-wrap">
					<strong>Initial request</strong>
					<p>{initialPrompt}</p>
				</div>
				{history.map((m, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: Conversation entries are append-only and never reordered.
					<div className="rounded bg-muted/30 p-2 text-sm" key={i}>
						{m.role === "user" ? (
							<p className="whitespace-pre-wrap">{m.content}</p>
						) : (
							<details>
								<summary>Structure proposal</summary>
								<pre className="overflow-auto text-xs max-h-52">
									{m.content}
								</pre>
							</details>
						)}
					</div>
				))}
				{proposal && (
					<div className="border rounded p-2 space-y-2">
						<p className="font-medium">
							Pending proposal: {proposal.models.length} models
						</p>
						<details>
							<summary className="text-sm cursor-pointer">
								Inspect changes
							</summary>
							<pre className="text-xs overflow-auto max-h-64">
								{JSON.stringify(
									JSON.parse(structureContext(proposal)),
									null,
									2,
								)}
							</pre>
						</details>
						{issues.map((issue) => (
							<p className="text-xs text-destructive" key={issue} role="alert">
								{issue}
							</p>
						))}
						{changed && (
							<p className="text-xs text-destructive" role="alert">
								Your structure changed after this request. Ask for an updated
								proposal before applying it.
							</p>
						)}
						<div className="flex gap-2">
							<Button
								disabled={busy || !!issues.length || changed}
								onClick={() => {
									onChange(mergeStructureProposal(latest.current, proposal));
									setProposal(null);
									setBase("");
								}}
								size="sm"
							>
								Accept
							</Button>
							<Button
								onClick={() => setProposal(null)}
								size="sm"
								variant="outline"
							>
								Reject
							</Button>
						</div>
					</div>
				)}
				{(error || errorMessage) && (
					<p className="text-sm text-destructive" role="alert">
						{errorMessage ?? error}
					</p>
				)}
			</div>
			<div className="border-t p-3 space-y-2">
				<details>
					<summary className="text-xs cursor-pointer">
						Attach model code
					</summary>
					{diagram.models
						.filter((m) => m.code)
						.map((m) => (
							<label className="block text-xs" key={m.id}>
								<input
									checked={codeIds.includes(m.id)}
									onChange={(e) =>
										setCodeIds(
											e.target.checked
												? [...codeIds, m.id]
												: codeIds.filter((id) => id !== m.id),
										)
									}
									type="checkbox"
								/>{" "}
								{m.name}
							</label>
						))}
				</details>
				<Textarea
					aria-label="Structure correction"
					disabled={busy}
					onChange={(e) => setText(e.target.value)}
					placeholder="Describe the correction you want…"
					value={text}
				/>
				<Dictation
					disabled={busy}
					key={conversationKey}
					onChange={setText}
					value={text}
				/>
				<Button
					className="w-full"
					disabled={busy || !text.trim()}
					onClick={request}
				>
					{busy ? "Preparing proposal…" : "Send correction"}
				</Button>
			</div>
		</aside>
	);
}
