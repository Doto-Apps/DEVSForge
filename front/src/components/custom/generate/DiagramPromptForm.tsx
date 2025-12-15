"use client";

import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DiagramPromptFormProps } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
	diagramName: z.string().min(2, {
		message: "Diagram name must be at least 2 characters.",
	}),
	prompt: z.string().min(10, {
		message: "Prompt must be at least 10 characters.",
	}),
});

export function DiagramPromptForm({
	onGenerate,
	isLoading,
	initialName = "",
	initialPrompt = "",
}: DiagramPromptFormProps) {
	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			diagramName: initialName,
			prompt: initialPrompt,
		},
	});

	const onSubmit = (values: z.infer<typeof formSchema>) => {
		onGenerate(values.diagramName, values.prompt);
	};

	if (isLoading) {
		return (
			<div className="h-full w-full flex justify-center items-center">
				<div className="flex flex-col items-center justify-center space-y-4">
					<Loader2 className="w-12 h-12 text-foreground animate-spin" />
					<p className="text-lg text-foreground">
						Generating your diagram...
					</p>
					<p className="text-sm text-muted-foreground">
						AI is analyzing your description and creating the DEVS model structure
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full w-full flex flex-col justify-center items-center p-8">
			<div className="flex items-center gap-3 pb-8">
				<Sparkles className="w-8 h-8 text-primary" />
				<h1 className="text-3xl font-bold">DEVS Model Generator</h1>
			</div>

			<p className="text-muted-foreground text-center mb-8 max-w-lg">
				Describe the system you want to model. The AI will generate the
				DEVS model structure with its components, ports, and connections.
			</p>

			<Form {...form}>
				<form
					onSubmit={form.handleSubmit(onSubmit)}
					className="w-full max-w-2xl space-y-6"
				>
					<FormField
						control={form.control}
						name="diagramName"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Diagram Name</FormLabel>
								<FormControl>
									<Input
										placeholder="e.g., Traffic Light System"
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="prompt"
						render={({ field }) => (
							<FormItem>
								<FormLabel>System Description</FormLabel>
								<FormControl>
									<Textarea
										placeholder="Describe the system to model. e.g., A traffic light system with two alternating lights. Each light has three states (green, yellow, red) with different durations. The lights must be synchronized so they are never green at the same time."
										className="resize-none min-h-[150px]"
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<Button type="submit" className="w-full" size="lg">
						<Sparkles className="w-4 h-4 mr-2" />
						Generate Structure
					</Button>
				</form>
			</Form>

			<div className="mt-8 p-4 bg-muted rounded-lg max-w-2xl">
				<h3 className="font-semibold mb-2">💡 Conseils pour un bon prompt</h3>
				<ul className="text-sm text-muted-foreground space-y-1">
					<li>• Décrivez les composants principaux du système</li>
					<li>• Mentionnez les interactions entre composants</li>
					<li>• Précisez les entrées et sorties du système</li>
					<li>• Indiquez les comportements temporels si pertinent</li>
				</ul>
			</div>
		</div>
	);
}
