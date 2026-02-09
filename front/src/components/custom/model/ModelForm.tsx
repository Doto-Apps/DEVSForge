"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { client } from "@/api/client.ts";
import { Form } from "@/components/form/Form";
import { FormSubmitError } from "@/components/form/FormSubmitError";
import { InputField } from "@/components/form/InputField";
import { RadioGroupField } from "@/components/form/RadioGroupField";
import { SelectField } from "@/components/form/SelectField";
import { Submit } from "@/components/form/Submit";
import { TextareaField } from "@/components/form/TextareaField";
import { SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { fetchLanguageTemplate, useGetLanguages } from "@/hooks/useLanguages";
import { useGetModels } from "@/queries/model/useGetModels";

const formSchema = z
	.object({
		name: z.string().min(3, {
			message: "The name must be at least 3 characters long.",
		}),
		description: z.string().optional(),
		type: z.enum(["atomic", "coupled"]),
		language: z.string().optional(),
	})
	.refine(
		(data) => {
			if (data.type === "atomic") {
				return data.language && data.language.length > 0;
			}
			return true;
		},
		{
			message: "Please select a language.",
			path: ["language"],
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
	const { toast } = useToast();
	const { data: languagesData } = useGetLanguages();

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			description: "",
			type: "atomic",
			language: "",
		},
	});

	const { mutate } = useGetModels();

	const selectedType = form.watch("type");

	const onSubmit = async (values: z.infer<typeof formSchema>) => {
		try {
			// Fetch the code template based on the selected language
			let code = "";
			if (values.type === "atomic" && values.language) {
				code = await fetchLanguageTemplate(values.language, values.name);
			}

			const response = await client.POST("/model", {
				body: {
					name: values.name,
					description: values.description ?? "",
					code: code,
					type: values.type,
					language: values.type === "coupled" ? "python" : values.language ?? "python",
					libId: libId,
					metadata: {
						style: {
							height: defaultSize,
							width: defaultSize,
						},
						position: {
							x: 0,
							y: 0,
						},
					},
					components: [],
					connections: [],
					ports: [],
				},
			});

			if (!response.data) {
				throw new Error("No data received from API");
			}

			toast({
				title: "Diagrams created successfully!",
			});

			await mutate();

			onSubmitSuccess?.();
			//todo : navigate to the diagram page
			form.reset();
		} catch (error) {
			toast({
				title: "Error creating diagram",
				description: (error as Error).message,
				variant: "destructive",
			});
		}
	};

	return (
		<div className="h-full w-full flex flex-col justify-center items-center">
			<div className="text-3xl text-foreground pb-20 font-bold">
				Create a new model
			</div>

			<Form methods={form} onSubmit={onSubmit} className="w-4/5 space-y-8">
				<InputField
					placeholder="My model name"
					label="Name"
					control={form.control}
					name="name"
				/>
				<TextareaField
					placeholder="An optional short description of this model."
					label="Description"
					control={form.control}
					name="description"
				/>
				<RadioGroupField
					control={form.control}
					name="type"
					label="Model type"
					description="Choose the type of model you want to create."
					options={[
						{ value: "atomic", label: "Atomic" },
						{ value: "coupled", label: "Coupled" },
					]}
				/>
				{selectedType === "atomic" && (
					<SelectField
						control={form.control}
						name="language"
						label="Language"
						description="Choose the programming language for your model."
						placeholder="Select a language"
					>
						{languagesData?.languages.map((lang) => (
							<SelectItem key={lang.id} value={lang.id}>
								{lang.name} - {lang.description}
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
