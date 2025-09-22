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
import { useGetDiagrams } from "@/queries/diagram/useGetDiagrams";

const formSchema = z.object({
	name: z.string().min(3, {
		message: "The name must be at least 3 characters long.",
	}),
	description: z.string(),
});

export default function DiagramForm({
	onSubmitSuccess,
	workspaceId,
}: {
	onSubmitSuccess?: () => void;
	workspaceId: string;
}) {
	const { toast } = useToast();

	// todo : faire une foction qui prend en param param id et la route et qui va chercher si le id exite en db si il n'existe pas on redirige vers la page d'erreur

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			description: "",
		},
	});

	const { mutate } = useGetDiagrams();

	const onSubmit = async (values: z.infer<typeof formSchema>) => {
		try {
			const response = await client.POST("/diagram", {
				body: {
					name: values.name,
					description: values.description,
					workspaceId: workspaceId,
				},
			});

			if (!response.data) {
				throw new Error("No data received from API");
			}

			toast({
				title: "Library created successfully!",
			});

			await mutate();

			onSubmitSuccess?.();
			//todo : navigate to the library detail page
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
				Create a new diagram
			</div>

			<Form methods={form} onSubmit={onSubmit} className="w-4/5 space-y-8">
				<InputField
					placeholder="My diagram name"
					label="Name"
					control={form.control}
					name="name"
				/>
				<TextareaField
					placeholder="An optional short description of this diagram."
					label="Description"
					control={form.control}
					name="description"
				/>
				<FormSubmitError />
				<Submit>Create diagram</Submit>
			</Form>
		</div>
	);
}
