import type { components } from "@/api/v1";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { POSSIBLE_PARAMETER_TYPE } from "@/constants";
import { getParameterDefaultValue } from "@/lib/getParameterDefaultValue";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu";
import { Code, Edit, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form } from "../form/Form";
import { InputField } from "../form/InputField";
import { SelectField } from "../form/SelectField";
import { Submit } from "../form/Submit";
import { ParameterInput } from "./reactFlow/ParameterInput";

const ParameterSchema = z.array(
	z.object({
		name: z.string(),
		type: z.enum(["int", "float", "bool", "string", "object"]),
		value: z.unknown().refine((x) => x !== undefined, "Required"),
		description: z.string().optional(),
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
};

export function ModelParameterEditor({
	parameters,
	onParametersChange,
	disabled,
}: Props) {
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
					{editAsJSON ? "Edit Parameters as JSON" : "Edit Parameters with UI"}
				</Label>
				<Button
					variant="secondary"
					size="icon"
					className="size-8"
					onClick={() => setEditAsJSON((prev) => !prev)}
				>
					{editAsJSON ? <Code size={18} /> : <Edit size={18} />}
				</Button>
			</div>

			{editAsJSON ? (
				<Textarea
					value={jsonInput}
					className="font-mono h-64"
					onChange={(e) => setJsonInput(e.target.value)}
					disabled={disabled}
					onBlur={() => {
						try {
							const parsed = ParameterSchema.parse(JSON.parse(jsonInput));
							onParametersChange(parsed);
						} catch (e) {
							alert("Invalid JSON or schema mismatch");
						}
					}}
				/>
			) : (
				parameters.map((param, index) => (
					<div key={`${param.name}-${index}`} className="space-y-2">
						<ParameterInput
							index={index}
							name={param.name}
							type={param.type}
							updateParameter={updateParameter}
							value={param.value}
							disabled={disabled}
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
					<Button variant="default" className="w-full">
						<Plus />
						Add a parameter
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent className="w-56 ">
					<Form
						methods={methods}
						onSubmit={onSubmitAddParameter}
						className="space-y-2 border p-3 rounded-md bg-background "
					>
						<Label className="font-semibold">Add Parameter</Label>

						<InputField
							placeholder="Name"
							label="Name"
							control={methods.control}
							name="name"
							required
						/>

						<SelectField
							label="Type"
							name="type"
							control={methods.control}
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
							name="description"
							label="Description"
							placeholder="Description (optional)"
						/>

						<Submit className="mt-2">Add Parameter</Submit>
					</Form>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
