"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import { client } from "@/api/client.ts";
import type { components } from "@/api/v1";
import { Form } from "@/components/form/Form";
import { FormSubmitError } from "@/components/form/FormSubmitError";
import { InputField } from "@/components/form/InputField";
import { RadioGroupField } from "@/components/form/RadioGroupField";
import { SelectField } from "@/components/form/SelectField";
import { Submit } from "@/components/form/Submit";
import { TextareaField } from "@/components/form/TextareaField";
import { SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
	fetchIntegrationTemplate,
	integrationKey,
	useIntegrations,
} from "@/hooks/useIntegrations";
import { useGetModels } from "@/queries/model/useGetModels";

const formSchema = z
	.object({
		description: z.string().optional(),
		integration: z.string().optional(),
		name: z.string().min(3, {
			message: "The name must be at least 3 characters long.",
		}),
		type: z.enum(["atomic", "coupled"]),
	})
	.refine(
		(data) => {
			if (data.type === "atomic") {
				return data.integration && data.integration.length > 0;
			}
			return true;
		},
		{
			message: "Please select an integration.",
			path: ["integration"],
		},
	);

const defaultSize = 200;

export default function ModelForm({
	onSubmitSuccess,
	libId,
}: {
	onSubmitSuccess?: () => void;
	libId: string;
}) {
	const navigate = useNavigate();
	const { toast } = useToast();
	const { data: integrations } = useIntegrations();

	const form = useForm<z.infer<typeof formSchema>>({
		defaultValues: {
			description: "",
			integration: "",
			name: "",
			type: "atomic",
		},
		resolver: zodResolver(formSchema),
	});

	const { mutate } = useGetModels();

	const selectedType = form.watch("type");

	const onSubmit = async (values: z.infer<typeof formSchema>) => {
		try {
			// Fetch the code template based on the selected language
			let code = "";
			if (values.type === "atomic" && values.integration) {
				const selected = integrations.find(
					(d) => integrationKey(d) === values.integration,
				);
				if (!selected) throw new Error("Select an integration");
				code = await fetchIntegrationTemplate(selected, values.name);
			}

			const payload: components["schemas"]["request.ModelRequest"] = {
				code: code,
				components: [],
				connections: [],
				description: values.description ?? "",
				integrationId:
					values.type === "atomic"
						? integrations.find((d) => integrationKey(d) === values.integration)
								?.id
						: undefined,
				integrationVersion:
					values.type === "atomic"
						? integrations.find((d) => integrationKey(d) === values.integration)
								?.version
						: undefined,
				libId: libId,
				metadata: {
					keyword: [],
					modelRole: "",
					position: {
						x: 0,
						y: 0,
					},
					style: {
						height: defaultSize,
						width: defaultSize,
					},
				},
				name: values.name,
				ports: [],
				type: values.type,
			};

			const response = await client.POST("/model", {
				body: payload,
			});

			if (!response.data?.id) {
				throw new Error("No model ID received from API");
			}

			toast({
				title: "Diagrams created successfully!",
			});

			await mutate();

			onSubmitSuccess?.();
			form.reset();
			navigate(`/library/${libId}/model/${response.data.id}`);
		} catch (error) {
			toast({
				description: (error as Error).message,
				title: "Error creating diagram",
				variant: "destructive",
			});
		}
	};

	return (
		<div className="h-full w-full flex flex-col justify-center items-center">
			<div className="text-3xl text-foreground pb-20 font-bold">
				Create a new model
			</div>

			<Form className="w-4/5 space-y-8" methods={form} onSubmit={onSubmit}>
				<InputField
					control={form.control}
					label="Name"
					name="name"
					placeholder="My model name"
				/>
				<TextareaField
					control={form.control}
					label="Description"
					name="description"
					placeholder="An optional short description of this model."
				/>
				<RadioGroupField
					control={form.control}
					description="Choose the type of model you want to create."
					label="Model type"
					name="type"
					options={[
						{ label: "Atomic", value: "atomic" },
						{ label: "Coupled", value: "coupled" },
					]}
				/>
				{selectedType === "atomic" && (
					<SelectField
						control={form.control}
						description="Choose the framework and language for your model."
						label="Integration"
						name="integration"
						placeholder="Select an integration"
					>
						{integrations
							.filter((d) => d.capabilities?.template)
							.map((lang) => (
								<SelectItem
									key={integrationKey(lang)}
									value={integrationKey(lang)}
								>
									{lang.name} ({lang.version})
								</SelectItem>
							))}
					</SelectField>
				)}
				<FormSubmitError />
				<Submit>Create model</Submit>
			</Form>
		</div>
	);
}
