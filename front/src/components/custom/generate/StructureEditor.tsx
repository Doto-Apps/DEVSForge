"use client";

import { ModelViewEditor } from "@/components/custom/ModelViewEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generatedDiagramToReactFlow } from "@/lib/llmToReactFlow";
import type { ReactFlowInput, StructureEditorProps } from "@/types";
import { ReactFlowProvider } from "@xyflow/react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

export function StructureEditor({
	diagram,
	onDiagramChange,
	onValidate,
	onRegenerate,
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

		const rfData = generatedDiagramToReactFlow(diagram);
		setReactFlowData(rfData);
		setAutoLayoutSignal((current) => current + 1);
	}, [diagram]);

	const handleReactFlowChange = (newData: ReactFlowInput) => {
		setReactFlowData(newData);
		// Sync with parent diagram if needed
		onDiagramChange({
			...diagram,
			reactFlowData: newData,
		});
	};

	return (
		<div className="h-full w-full flex flex-col">
			{/* Header with actions */}
			<div className="flex items-center justify-between p-4 border-b bg-background">
				<div>
					<h2 className="text-xl font-semibold">{diagram.name}</h2>
					<p className="text-sm text-muted-foreground">
						{diagram.models.length} model(s) •{" "}
						{diagram.models.filter((m) => m.type === "atomic").length} atomic •{" "}
						{diagram.models.filter((m) => m.type === "coupled").length} coupled
					</p>
				</div>
				<div className="flex gap-2">
					<Button variant="outline" onClick={onRegenerate}>
						<RefreshCw className="w-4 h-4 mr-2" />
						Regenerate
					</Button>
					<Button onClick={onValidate}>
						<CheckCircle2 className="w-4 h-4 mr-2" />
						Validate Structure
					</Button>
				</div>
			</div>

			{/* Main content */}
			<div className="flex-1 flex overflow-hidden">
				{/* Left panel: models list */}
				<div className="w-80 border-r bg-muted/30 flex flex-col">
					<div className="p-4 border-b">
						<h3 className="font-semibold">Generated Models</h3>
						<p className="text-xs text-muted-foreground mt-1">
							Code generation order (dependencies first)
						</p>
					</div>
					<div className="flex-1 overflow-auto">
						<div className="p-2 space-y-2">
							{diagram.models.map((model, index) => (
								<Card
									key={model.id}
									className={`cursor-pointer hover:bg-accent transition-colors ${
										model.type === "coupled" ? "border-primary/50" : ""
									}`}
								>
									<CardHeader className="p-3 pb-2">
										<CardTitle className="text-sm flex items-center gap-2">
											<span className="text-xs bg-muted px-1.5 py-0.5 rounded">
												{index + 1}
											</span>
											{model.name}
											<span
												className={`ml-auto text-xs px-2 py-0.5 rounded ${
													model.type === "atomic"
														? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
														: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
												}`}
											>
												{model.type}
											</span>
										</CardTitle>
									</CardHeader>
									<CardContent className="p-3 pt-0">
										<div className="text-xs text-muted-foreground space-y-1">
											{model.ports.in.length > 0 && (
												<div>
													<span className="font-medium">In:</span>{" "}
													{model.ports.in.join(", ")}
												</div>
											)}
											{model.ports.out.length > 0 && (
												<div>
													<span className="font-medium">Out:</span>{" "}
													{model.ports.out.join(", ")}
												</div>
											)}
											{model.components && model.components.length > 0 && (
												<div>
													<span className="font-medium">Components:</span>{" "}
													{model.components.join(", ")}
												</div>
											)}
											{model.dependencies.length > 0 && (
												<div className="text-orange-600 dark:text-orange-400">
												<span className="font-medium">Depends on:</span>{" "}
													{model.dependencies.join(", ")}
												</div>
											)}
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					</div>
				</div>

				{/* Right panel: ReactFlow visualization */}
				<div className="flex-1">
					{reactFlowData ? (
						<ReactFlowProvider>
							<ModelViewEditor
								models={reactFlowData}
								onChange={handleReactFlowChange}
								autoLayoutSignal={autoLayoutSignal}
							/>
						</ReactFlowProvider>
					) : (
						<div className="h-full flex items-center justify-center">
							<p className="text-muted-foreground">Loading...</p>
						</div>
					)}
				</div>
			</div>

			{/* Connections */}
			<div className="border-t p-4 bg-muted/30">
				<h3 className="font-semibold mb-2">
					Connections ({diagram.connections.length})
				</h3>
				<div className="flex flex-wrap gap-2">
					{diagram.connections.map((conn) => (
						<div
							key={`${conn.from.model}:${conn.from.port}-${conn.to.model}:${conn.to.port}`}
							className="text-xs bg-background border rounded px-2 py-1"
						>
							{conn.from.model}:{conn.from.port} → {conn.to.model}:
							{conn.to.port}
						</div>
					))}
					{diagram.connections.length === 0 && (
						<p className="text-sm text-muted-foreground">
							No connections defined
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
