import type { Node } from "@xyflow/react";
import { Loader2, Sparkles, X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
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
import { Textarea } from "../ui/textarea";
import { ModelParameterEditor } from "./ModelParameterEditor";
import { PortEditor } from "./reactFlow/PortEditor";

const MODEL_ROLES = [
	"atomic",
	"coupled",
	"generator",
	"transducer",
	"acceptor",
	"experimental-frame",
] as const;

type Props = {
	model: Node<ReactFlowModelData>;
	onChange?: (model: Node<ReactFlowModelData>) => void;
	disabled: boolean;
	allowParameterValueEdit?: boolean;
};

export function ModelPropertyEditor({
	model,
	onChange,
	disabled,
	allowParameterValueEdit = false,
}: Props) {
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
				description: "Description, keywords, and role have been updated.",
				title: "Documentation generated",
			});
		} else {
			toast({
				description: "Failed to generate documentation. Please try again.",
				title: "Generation failed",
				variant: "destructive",
			});
		}
	};

	return (
		<div className="h-full w-full bg-card p-4 space-y-4 text-sm overflow-y-auto">
			<Accordion className="w-full" defaultValue={["item-1"]} type="multiple">
				<AccordionItem value="item-1">
					<div className="flex items-center justify-between">
						<AccordionTrigger className="font-semibold text-md flex-1">
							Information
						</AccordionTrigger>
						<Button
							className="h-8 px-2 mr-2"
							disabled={disabled || isGenerating}
							onClick={handleGenerateDocumentation}
							size="sm"
							title="Generate documentation with AI"
							variant="ghost"
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
								className="mt-1"
								disabled={disabled}
								onChange={(e) => update({ label: e.target.value })}
								value={model.data.label}
							/>
						</div>

						<div>
							<Label>Model Description</Label>
							<Textarea
								className="font-mono h-32"
								disabled={disabled}
								onChange={(e) => update({ description: e.target.value })}
								value={model.data.description}
							/>
						</div>

						<div>
							<Label>Model Role</Label>
							<Select
								disabled={disabled}
								onValueChange={(value) => update({ modelRole: value })}
								value={model.data.modelRole || ""}
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
										className="flex items-center gap-1 pr-1"
										key={kw}
										variant="secondary"
									>
										{kw}
										{!disabled && (
											<button
												className="hover:bg-muted rounded-full p-0.5"
												onClick={() => removeKeyword(kw)}
												type="button"
											>
												<X className="h-3 w-3" />
											</button>
										)}
									</Badge>
								))}
							</div>
							<Input
								disabled={disabled}
								onBlur={() => keywordInput && addKeyword(keywordInput)}
								onChange={(e) => setKeywordInput(e.target.value)}
								onKeyDown={handleKeywordKeyDown}
								placeholder="Add keyword (Enter to add)"
								value={keywordInput}
							/>
						</div>

						{/* Type */}
						<div>
							<Label>Model Type</Label>
							<Select
								disabled={disabled}
								onValueChange={(value) =>
									update({ modelType: value as "atomic" | "coupled" })
								}
								value={model.data.modelType}
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
							defaultPrefix="in"
							disabled={disabled}
							label="Input Ports"
							onChange={(ports) => handlePortUpdate("input", ports)}
							ports={model.data.inputPorts ?? []}
						/>

						<PortEditor
							defaultPrefix="out"
							disabled={disabled}
							label="Output Ports"
							onChange={(ports) => handlePortUpdate("output", ports)}
							ports={model.data.outputPorts ?? []}
						/>
					</AccordionContent>
				</AccordionItem>
				<AccordionItem value="item-2">
					<AccordionTrigger className="font-semibold">
						Parameters
					</AccordionTrigger>
					<AccordionContent className="flex flex-col gap-4 text-balance p-1">
						<ModelParameterEditor
							disabled={disabled}
							onParametersChange={handleParametersChange}
							parameters={model.data.parameters ?? []}
							valueOnly={disabled && allowParameterValueEdit}
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
								disabled={disabled}
								onChange={(e) =>
									updateGraphical("headerBackgroundColor", e.target.value)
								}
								type="color"
								value={graphicalData.headerBackgroundColor || "#000000"}
							/>
						</div>

						<div className="space-y-1">
							<Label className="text-xs">Header Text Color</Label>
							<Input
								disabled={disabled}
								onChange={(e) =>
									updateGraphical("headerTextColor", e.target.value)
								}
								type="color"
								value={graphicalData.headerTextColor || "#ffffff"}
							/>
						</div>

						<div className="space-y-1">
							<Label className="text-xs">Body Background Color</Label>
							<Input
								disabled={disabled}
								onChange={(e) =>
									updateGraphical("bodyBackgroundColor", e.target.value)
								}
								type="color"
								value={graphicalData.bodyBackgroundColor || "#eeeeee"}
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
							<Input className="mt-1" disabled value={model.id} />
						</div>
						<div>
							<Label>Model ID</Label>
							<Input className="mt-1" disabled value={model.data.id} />
						</div>
						<Label>Input Ports</Label>
						{model.data.inputPorts?.map((ip) => {
							return (
								<div key={`inputport${ip.id}`}>
									<Input className="mt-1" disabled value={ip.id} />
								</div>
							);
						})}
						<Label>Output Ports</Label>
						{model.data.outputPorts?.map((op) => {
							return (
								<div key={`outputport${op.id}`}>
									<Input className="mt-1" disabled value={op.id} />
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
