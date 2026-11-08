"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { ArrowRight, FileCode2, Network, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { ModelViewEditor } from "@/components/custom/ModelViewEditor";
import { Button } from "@/components/ui/button";
import {
	generatedDiagramToReactFlow,
	syncGeneratedStructure,
	validateGeneratedStructure,
} from "@/lib/llmToReactFlow";
import type { ReactFlowInput, StructureEditorProps } from "@/types";

export function StructureEditor({
	diagram,
	onDiagramChange,
	onValidate,
	onRegenerate,
	conversation,
}: StructureEditorProps) {
	const [reactFlowData, setReactFlowData] = useState<ReactFlowInput | null>(
		null,
	);
	const [autoLayoutSignal, setAutoLayoutSignal] = useState(0);
	useEffect(() => {
		if (diagram.reactFlowData) {
			setReactFlowData(diagram.reactFlowData);
			return;
		}
		setReactFlowData(generatedDiagramToReactFlow(diagram));
		setAutoLayoutSignal((current) => current + 1);
	}, [diagram]);
	const handleReactFlowChange = (newData: ReactFlowInput) => {
		setReactFlowData(newData);
		onDiagramChange(syncGeneratedStructure(diagram, newData));
	};
	const issues = validateGeneratedStructure(diagram);
	return (
		<div className="flex h-full min-w-0 w-full flex-col">
			<div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 lg:px-6">
				<div className="min-w-0">
					<h2 className="truncate text-base font-medium">{diagram.name}</h2>
					<p className="mt-1 text-xs text-muted-foreground">
						{diagram.models.filter((model) => model.type === "atomic").length}{" "}
						atomic ·{" "}
						{diagram.models.filter((model) => model.type === "coupled").length}{" "}
						coupled · {diagram.connections.length} connections
					</p>
				</div>
				<div className="flex gap-2">
					<Button size="sm" onClick={onRegenerate} variant="ghost">
						<RefreshCw size={14} />
						Regenerate
					</Button>
					<Button size="sm" disabled={issues.length > 0} onClick={onValidate}>
						Continue to code
						<ArrowRight size={14} />
					</Button>
				</div>
			</div>
			{issues.length > 0 && (
				<div
					role="alert"
					className="shrink-0 px-4 py-2 text-xs text-destructive"
				>
					{issues.join("; ")}
				</div>
			)}
			<div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
				<aside
					aria-label="Structure models"
					className="max-h-40 w-full shrink-0 overflow-auto border-b lg:max-h-none lg:w-56 lg:border-b-0 lg:border-r xl:w-64"
				>
					<div className="px-4 py-3">
						<h3 className="text-xs font-medium">Models</h3>
						<p className="mt-1 text-[11px] text-muted-foreground">
							Components and interfaces
						</p>
					</div>
					<ul className="divide-y px-4">
						{diagram.models.map((model) => (
							<li key={model.id} className="py-3">
								<div className="flex items-center gap-2 text-xs font-medium">
									{model.type === "coupled" ? (
										<Network
											size={14}
											className="shrink-0 text-muted-foreground"
										/>
									) : (
										<FileCode2
											size={14}
											className="shrink-0 text-muted-foreground"
										/>
									)}
									<span className="truncate">{model.name}</span>
									<span className="ml-auto text-[10px] font-normal text-muted-foreground">
										{model.type}
									</span>
								</div>
								<p className="mt-1.5 break-words text-[11px] leading-5 text-muted-foreground">
									{model.ports.in.length} in · {model.ports.out.length} out
									{model.components?.length
										? ` · ${model.components.length} components`
										: ""}
								</p>
								{model.ports.in.length > 0 && (
									<p className="break-words text-[11px] leading-5 text-muted-foreground">
										In: {model.ports.in.join(", ")}
									</p>
								)}
								{model.ports.out.length > 0 && (
									<p className="break-words text-[11px] leading-5 text-muted-foreground">
										Out: {model.ports.out.join(", ")}
									</p>
								)}
								{model.dependencies.length > 0 && (
									<p className="mt-1 break-words text-[11px] leading-5 text-muted-foreground">
										Uses {model.dependencies.join(", ")}
									</p>
								)}
							</li>
						))}
					</ul>
				</aside>
				<div className="min-h-[320px] min-w-0 flex-1 lg:min-h-0">
					{reactFlowData ? (
						<ReactFlowProvider>
							<ModelViewEditor
								autoLayoutSignal={autoLayoutSignal || undefined}
								models={reactFlowData}
								onChange={handleReactFlowChange}
							/>
						</ReactFlowProvider>
					) : (
						<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
							Loading diagram…
						</div>
					)}
				</div>
				{conversation}
			</div>
			<div className="max-h-28 shrink-0 overflow-auto border-t px-4 py-3 text-xs lg:px-6">
				<h3 className="mb-2 font-medium">
					Connections{" "}
					<span className="font-normal text-muted-foreground">
						({diagram.connections.length})
					</span>
				</h3>
				<div className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] text-muted-foreground">
					{diagram.connections.map((connection) => (
						<span
							className="break-all"
							key={`${connection.owner}:${connection.from?.model}:${connection.from?.port}-${connection.to?.model}:${connection.to?.port}`}
						>
							{connection.from?.model}:{connection.from?.port} →{" "}
							{connection.to?.model}:{connection.to?.port}
						</span>
					))}
					{!diagram.connections.length && (
						<span className="font-sans">No connections defined.</span>
					)}
				</div>
			</div>
		</div>
	);
}
