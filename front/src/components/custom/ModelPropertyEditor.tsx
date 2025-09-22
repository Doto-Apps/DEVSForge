import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { ReactFlowModelData } from "@/types";
import type { Node } from "@xyflow/react";
import { v4 as uuidv4 } from "uuid";
import { ModelParameterEditor } from "./ModelParameterEditor";
import { PortCountEditor } from "./reactFlow/PortCountEditor";

type Props = {
	model: Node<ReactFlowModelData>;
	onChange?: (model: Node<ReactFlowModelData>) => void;
	disabled: boolean;
};

export function ModelPropertyEditor({ model, onChange, disabled }: Props) {
	const update = (changes: Partial<ReactFlowModelData>) => {
		onChange?.({
			...model,
			data: {
				...model.data,
				...changes,
			},
		});
	};

	const handlePortUpdate = (
		action: "add" | "remove",
		portType: "input" | "output",
	) => {
		const portsKey = portType === "input" ? "inputPorts" : "outputPorts";
		const existing = model.data[portsKey] ?? [];

		let updated: typeof existing;
		if (action === "add") {
			updated = [...existing, { id: uuidv4() }];
		} else {
			updated = existing.slice(0, -1);
		}

		update({ [portsKey]: updated } as Partial<ReactFlowModelData>);
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

	return (
		<div className="h-full w-full bg-card p-4 space-y-4 text-sm">
			<Accordion type="multiple" className="w-full" defaultValue={["item-1"]}>
				<AccordionItem value="item-1">
					<AccordionTrigger className="font-semibold text-md">
						Information
					</AccordionTrigger>
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
						<PortCountEditor
							label="Input Ports"
							count={model.data.inputPorts?.length ?? 0}
							onAdd={() => handlePortUpdate("add", "input")}
							onRemove={() => handlePortUpdate("remove", "input")}
							disabled={disabled}
						/>

						<PortCountEditor
							label="Output Ports"
							count={model.data.outputPorts?.length ?? 0}
							onAdd={() => handlePortUpdate("add", "output")}
							onRemove={() => handlePortUpdate("remove", "output")}
							disabled={disabled}
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
