"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { client } from "@/api/client.ts";
import { Form } from "@/components/form/Form";
import { FormSubmitError } from "@/components/form/FormSubmitError";
import { InputField } from "@/components/form/InputField";
import { Submit } from "@/components/form/Submit";
import { TextareaField } from "@/components/form/TextareaField";
import { useToast } from "@/hooks/use-toast";
import { useGetWorkspaces } from "@/queries/workspace/useGetWorkspaces";

const formSchema = z.object({
	title: z.string().min(3, {
		message: "The name must be at least 3 characters long.",
	}),
	description: z.string(),
});

export default function WorkspaceForm({
	onSubmitSuccess,
}: {
	onSubmitSuccess?: () => void;
}) {
	const { toast } = useToast();

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			title: "",
			description: "",
		},
	});

	const { mutate } = useGetWorkspaces();
	const onSubmit = async (values: z.infer<typeof formSchema>) => {
		try {
			const response = await client.POST("/workspace", {
				body: {
					title: values.title,
					description: values.description,
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
				Create a new workspace
			</div>

			<Form methods={form} onSubmit={onSubmit} className="w-4/5 space-y-8">
				<InputField
					placeholder="My workspace title"
					label="Title"
					control={form.control}
					name="title"
				/>
				<TextareaField
					placeholder="A short description of this workspace."
					label="Description"
					control={form.control}
					name="description"
				/>
				<FormSubmitError />
				<Submit>Create workspace</Submit>
			</Form>
		</div>
	);
}
