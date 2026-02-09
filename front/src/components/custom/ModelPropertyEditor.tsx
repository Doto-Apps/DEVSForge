import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useGenerateDocumentation } from "@/hooks/useGenerateDocumentation";
import type { ReactFlowModelData } from "@/types";
import type { Node } from "@xyflow/react";
import { Loader2, Sparkles, X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { Textarea } from "../ui/textarea";
import { ModelParameterEditor } from "./ModelParameterEditor";
import { PortEditor } from "./reactFlow/PortEditor";

const MODEL_ROLES = ["generator", "transducer", "observer"] as const;

type Props = {
	model: Node<ReactFlowModelData>;
	onChange?: (model: Node<ReactFlowModelData>) => void;
	disabled: boolean;
};

export function ModelPropertyEditor({ model, onChange, disabled }: Props) {
	const [keywordInput, setKeywordInput] = useState("");
	const { generateDocumentation, isLoading: isGenerating } =
		useGenerateDocumentation();
	const { toast } = useToast();

	const update = (changes: Partial<ReactFlowModelData>) => {
		onChange?.({
			...model,
			data: {
				...model.data,
				...changes,
			},
		});
	};

	const addKeyword = (keyword: string) => {
		const trimmed = keyword.trim();
		if (trimmed && !model.data.keyword?.includes(trimmed)) {
			update({ keyword: [...(model.data.keyword ?? []), trimmed] });
		}
		setKeywordInput("");
	};

	const removeKeyword = (keywordToRemove: string) => {
		update({
			keyword: model.data.keyword?.filter((k) => k !== keywordToRemove) ?? [],
		});
	};

	const handleKeywordKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" || e.key === ",") {
			e.preventDefault();
			addKeyword(keywordInput);
		}
	};

	const handlePortUpdate = (
		portType: "input" | "output",
		ports: typeof model.data.inputPorts,
	) => {
		const portsKey = portType === "input" ? "inputPorts" : "outputPorts";
		update({ [portsKey]: ports } as Partial<ReactFlowModelData>);
	};

	const graphicalData = model.data.reactFlowModelGraphicalData ?? {};

	const updateGraphical = (
		field: keyof typeof graphicalData,
		value: string,
	) => {
		update({
			reactFlowModelGraphicalData: {
				...graphicalData,
				[field]: value,
			},
		});
	};

	const handleParametersChange = (params: ReactFlowModelData["parameters"]) => {
		update({ parameters: params });
	};

	const handleGenerateDocumentation = async () => {
		const result = await generateDocumentation(model.data.id);
		if (result) {
			update({
				description: result.description,
				keyword: result.keywords,
				modelRole: result.role,
			});
			toast({
				title: "Documentation generated",
				description: "Description, keywords, and role have been updated.",
			});
		} else {
			toast({
				title: "Generation failed",
				description: "Failed to generate documentation. Please try again.",
				variant: "destructive",
			});
		}
	};

	return (
		<div className="h-full w-full bg-card p-4 space-y-4 text-sm overflow-y-auto">
			<Accordion type="multiple" className="w-full" defaultValue={["item-1"]}>
				<AccordionItem value="item-1">
					<div className="flex items-center justify-between">
						<AccordionTrigger className="font-semibold text-md flex-1">
							Information
						</AccordionTrigger>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleGenerateDocumentation}
							disabled={disabled || isGenerating}
							className="h-8 px-2 mr-2"
							title="Generate documentation with AI"
						>
							{isGenerating ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Sparkles className="h-4 w-4" />
							)}
						</Button>
					</div>
					<AccordionContent className="flex flex-col gap-4 text-balance p-1">
						<div>
							<Label>Model Name</Label>
							<Input
								value={model.data.label}
								onChange={(e) => update({ label: e.target.value })}
								className="mt-1"
								disabled={disabled}
							/>
						</div>

						<div>
							<Label>Model Description</Label>
							<Textarea
								value={model.data.description}
								className="font-mono h-32"
								onChange={(e) => update({ description: e.target.value })}
								disabled={disabled}
							/>
						</div>

						<div>
							<Label>Model Role</Label>
							<Select
								value={model.data.modelRole || ""}
								onValueChange={(value) => update({ modelRole: value })}
								disabled={disabled}
							>
								<SelectTrigger className="mt-1">
									<SelectValue placeholder="Select a role" />
								</SelectTrigger>
								<SelectContent>
									{MODEL_ROLES.map((role) => (
										<SelectItem key={role} value={role}>
											{role.charAt(0).toUpperCase() + role.slice(1)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div>
							<Label>Keywords</Label>
							<div className="flex flex-wrap gap-1.5 mt-1 mb-2">
								{model.data.keyword?.map((kw) => (
									<Badge
										key={kw}
										variant="secondary"
										className="flex items-center gap-1 pr-1"
									>
										{kw}
										{!disabled && (
											<button
												type="button"
												onClick={() => removeKeyword(kw)}
												className="hover:bg-muted rounded-full p-0.5"
											>
												<X className="h-3 w-3" />
											</button>
										)}
									</Badge>
								))}
							</div>
							<Input
								value={keywordInput}
								onChange={(e) => setKeywordInput(e.target.value)}
								onKeyDown={handleKeywordKeyDown}
								onBlur={() => keywordInput && addKeyword(keywordInput)}
								placeholder="Add keyword (Enter to add)"
								disabled={disabled}
							/>
						</div>

						{/* Type */}
						<div>
							<Label>Model Type</Label>
							<Select
								value={model.data.modelType}
								onValueChange={(value) =>
									update({ modelType: value as "atomic" | "coupled" })
								}
								disabled={disabled}
							>
								<SelectTrigger className="mt-1">
									<SelectValue placeholder="Select model type" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="atomic">Atomic</SelectItem>
									<SelectItem value="coupled">Coupled</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{/* Ports */}
						<PortEditor
							label="Input Ports"
							ports={model.data.inputPorts ?? []}
							onChange={(ports) => handlePortUpdate("input", ports)}
							disabled={disabled}
							defaultPrefix="in"
						/>

						<PortEditor
							label="Output Ports"
							ports={model.data.outputPorts ?? []}
							onChange={(ports) => handlePortUpdate("output", ports)}
							disabled={disabled}
							defaultPrefix="out"
						/>
					</AccordionContent>
				</AccordionItem>
				<AccordionItem value="item-2">
					<AccordionTrigger className="font-semibold">
						Parameters
					</AccordionTrigger>
					<AccordionContent className="flex flex-col gap-4 text-balance p-1">
						<ModelParameterEditor
							parameters={model.data.parameters ?? []}
							onParametersChange={handleParametersChange}
							disabled={disabled}
						/>
					</AccordionContent>
				</AccordionItem>
				<AccordionItem value="item-3">
					<AccordionTrigger className="font-semibold">
						Graphical Options
					</AccordionTrigger>
					<AccordionContent className="flex flex-col gap-4 text-balance p-1">
						<div className="space-y-1">
							<Label className="text-xs">Header Background Color</Label>
							<Input
								type="color"
								value={graphicalData.headerBackgroundColor || "#000000"}
								onChange={(e) =>
									updateGraphical("headerBackgroundColor", e.target.value)
								}
								disabled={disabled}
							/>
						</div>

						<div className="space-y-1">
							<Label className="text-xs">Header Text Color</Label>
							<Input
								type="color"
								value={graphicalData.headerTextColor || "#ffffff"}
								onChange={(e) =>
									updateGraphical("headerTextColor", e.target.value)
								}
								disabled={disabled}
							/>
						</div>

						<div className="space-y-1">
							<Label className="text-xs">Body Background Color</Label>
							<Input
								type="color"
								value={graphicalData.bodyBackgroundColor || "#eeeeee"}
								onChange={(e) =>
									updateGraphical("bodyBackgroundColor", e.target.value)
								}
								disabled={disabled}
							/>
						</div>
					</AccordionContent>
				</AccordionItem>
				<AccordionItem value="item-4">
					<AccordionTrigger className="font-semibold text-md">
						Extra Information
					</AccordionTrigger>
					<AccordionContent className="flex flex-col gap-4 text-balance p-1">
						<div>
							<Label>Instance ID</Label>
							<Input value={model.id} disabled className="mt-1" />
						</div>
						<div>
							<Label>Model ID</Label>
							<Input value={model.data.id} disabled className="mt-1" />
						</div>
						<Label>Input Ports</Label>
						{model.data.inputPorts?.map((ip) => {
							return (
								<div key={`inputport${ip.id}`}>
									<Input value={ip.id} disabled className="mt-1" />
								</div>
							);
						})}
						<Label>Output Ports</Label>
						{model.data.outputPorts?.map((op) => {
							return (
								<div key={`outputport${op.id}`}>
									<Input value={op.id} disabled className="mt-1" />
								</div>
							);
						})}
					</AccordionContent>
				</AccordionItem>
				<AccordionItem value="item-5">
					<AccordionTrigger className="font-semibold text-md">
						Export
					</AccordionTrigger>
					<AccordionContent className="flex flex-col gap-4 text-balance p-1">
						TODO
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	);
}
