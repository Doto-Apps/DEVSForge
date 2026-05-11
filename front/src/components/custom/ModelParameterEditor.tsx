import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu";
import { Code, Edit, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { components } from "@/api/v1";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { POSSIBLE_PARAMETER_TYPE } from "@/constants";
import { getParameterDefaultValue } from "@/lib/getParameterDefaultValue";
import { Form } from "../form/Form";
import { InputField } from "../form/InputField";
import { SelectField } from "../form/SelectField";
import { Submit } from "../form/Submit";
import { ParameterInput } from "./reactFlow/ParameterInput";

const ParameterSchema = z.array(
	z.object({
		description: z.string().optional(),
		name: z.string(),
		type: z.enum(["int", "float", "bool", "string", "object"]),
		value: z.unknown().refine((x) => x !== undefined, "Required"),
	}),
);

type Props = {
	parameters: NonNullable<
		components["schemas"]["response.ModelResponse"]["metadata"]["parameters"]
	>;
	onParametersChange: (
		params: NonNullable<
			components["schemas"]["response.ModelResponse"]["metadata"]["parameters"]
		>,
	) => void;
	disabled: boolean;
	valueOnly?: boolean;
};

export function ModelParameterEditor({
	parameters,
	onParametersChange,
	disabled,
	valueOnly = false,
}: Props) {
	const canEditValues = !disabled || valueOnly;
	const canEditSchema = !disabled && !valueOnly;
	const [editAsJSON, setEditAsJSON] = useState(false);
	const [jsonInput, setJsonInput] = useState(
		JSON.stringify(parameters, null, 2),
	);
	const methods = useForm<(typeof parameters)[number]>({
		defaultValues: {
			name: "",
			type: "string",
			value: "",
		},
		mode: "onChange",
	});
	const updateParameter = (index: number, newValue: unknown) => {
		const updated = [...parameters];
		updated[index] = { ...updated[index], value: newValue };
		onParametersChange(updated);
	};

	const onSubmitAddParameter = (newParam: (typeof parameters)[number]) => {
		if (!newParam.name || !newParam.type) return;
		onParametersChange([
			...parameters,
			{ ...newParam, value: getParameterDefaultValue(newParam) },
		]);
		methods.reset({ name: "", type: "string", value: "" });
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-2">
				<Label>
					{valueOnly
						? "Override of Parameter (Sub model)"
						: editAsJSON
							? "Edit Parameters as JSON"
							: "Edit Parameters with UI"}
				</Label>
				{!valueOnly ? (
					<Button
						className="size-8"
						disabled={!canEditSchema}
						onClick={() => setEditAsJSON((prev) => !prev)}
						size="icon"
						variant="secondary"
					>
						{editAsJSON ? <Code size={18} /> : <Edit size={18} />}
					</Button>
				) : null}
			</div>

			{editAsJSON ? (
				<Textarea
					className="font-mono h-64"
					disabled={!canEditSchema}
					onBlur={() => {
						try {
							const parsed = ParameterSchema.parse(JSON.parse(jsonInput));
							onParametersChange(parsed);
						} catch {
							alert("Invalid JSON or schema mismatch");
						}
					}}
					onChange={(e) => setJsonInput(e.target.value)}
					value={jsonInput}
				/>
			) : (
				parameters.map((param, index) => (
					<div className="space-y-2" key={`${param.name}`}>
						<ParameterInput
							disabled={!canEditValues}
							index={index}
							name={param.name}
							type={param.type}
							updateParameter={updateParameter}
							value={param.value}
						/>

						{param.description ? (
							<p className="text-xs text-muted-foreground">
								{param.description}
							</p>
						) : null}
					</div>
				))
			)}

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						className="w-full"
						disabled={!canEditSchema}
						variant="default"
					>
						<Plus />
						Add a parameter
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent className="w-56 ">
					<Form
						className="space-y-2 border p-3 rounded-md bg-background "
						methods={methods}
						onSubmit={onSubmitAddParameter}
					>
						<Label className="font-semibold">Add Parameter</Label>

						<InputField
							control={methods.control}
							label="Name"
							name="name"
							placeholder="Name"
							required
						/>

						<SelectField
							control={methods.control}
							label="Type"
							name="type"
							placeholder="Select type"
						>
							{POSSIBLE_PARAMETER_TYPE.map((type) => (
								<SelectItem key={type} value={type}>
									{type}
								</SelectItem>
							))}
						</SelectField>

						<InputField
							control={methods.control}
							label="Description"
							name="description"
							placeholder="Description (optional)"
						/>

						<Submit className="mt-2">Add Parameter</Submit>
					</Form>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
