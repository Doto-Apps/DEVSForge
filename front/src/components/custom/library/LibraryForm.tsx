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
import { useGetLibraries } from "@/queries/library/useGetLibraries.ts";

const formSchema = z.object({
	description: z.string(),
	title: z.string().min(3, {
		message: "The title must be at least 3 characters long.",
	}),
});

export default function LibraryForm({
	onSubmitSuccess,
}: {
	onSubmitSuccess?: () => void;
}) {
	const { toast } = useToast();

	const form = useForm<z.infer<typeof formSchema>>({
		defaultValues: {
			description: "",
			title: "",
		},
		resolver: zodResolver(formSchema),
	});

	const { mutate } = useGetLibraries();
	const onSubmit = async (values: z.infer<typeof formSchema>) => {
		try {
			const response = await client.POST("/library", {
				body: {
					description: values.description,
					title: values.title,
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
				description: (error as Error).message,
				title: "Error creating library",
				variant: "destructive",
			});
		}
	};

	return (
		<div className="h-full w-full flex flex-col justify-center items-center">
			<div className="text-3xl text-foreground pb-20 font-bold">
				Create a new Library
			</div>

			<Form className="w-4/5 space-y-8" methods={form} onSubmit={onSubmit}>
				<InputField
					control={form.control}
					label="Title"
					name="title"
					placeholder="My library name"
				/>
				<TextareaField
					control={form.control}
					label="Description"
					name="description"
					placeholder="A short description of this library."
				/>
				<FormSubmitError />
				<Submit>Create Library</Submit>
			</Form>
		</div>
	);
}
