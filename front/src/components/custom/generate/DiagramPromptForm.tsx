"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Dictation } from "@/components/custom/Dictation";
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

const formSchema = z.object({
	diagramName: z
		.string()
		.min(2, { message: "Diagram name must be at least 2 characters." }),
	prompt: z
		.string()
		.min(10, { message: "Prompt must be at least 10 characters." }),
});
const example = `Generate only the structure, ports and connections.
Create a coupled Home containing two coupled models, Room1 and Room2, and an atomic GeneralSwitch.
Room1 contains atomic Switch1 and Light1. Room2 contains atomic Switch2 and Light2.
Each switch has an output port state. Each light has input ports local and general.
Inside each room, connect its switch.state to its light.local.
Each room exposes an input port general, connected internally to its light.general.
Inside Home, connect GeneralSwitch.state to Room1.general and Room2.general.
Add no other components or connections. Behavior and code will be defined in the next step.`;

export function DiagramPromptForm({
	onGenerate,
	isLoading,
	initialName = "",
	initialPrompt = "",
}: DiagramPromptFormProps) {
	const form = useForm<z.infer<typeof formSchema>>({
		defaultValues: { diagramName: initialName, prompt: initialPrompt },
		resolver: zodResolver(formSchema),
	});
	return (
		<div className="h-full w-full overflow-y-auto px-4 py-6 lg:px-6">
			<header className="mb-7">
				<h1 className="text-2xl font-semibold tracking-tight">
					Describe your system
				</h1>
				<p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
					Describe the components, their hierarchy, ports and connections.
					Define each model’s behavior in the code step.
				</p>
			</header>
			<div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_280px]">
				<Form {...form}>
					<form
						className="min-w-0 space-y-6"
						onSubmit={form.handleSubmit((values) =>
							onGenerate(values.diagramName, values.prompt),
						)}
					>
						<FormField
							control={form.control}
							name="diagramName"
							render={({ field }) => (
								<FormItem>
									<FormLabel>System name</FormLabel>
									<FormControl>
										<Input placeholder="Home" disabled={isLoading} {...field} />
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
									<FormLabel>Structure and connections</FormLabel>
									<FormControl>
										<Textarea
											className="min-h-[240px] resize-y text-sm leading-7"
											placeholder="Which models are atomic or coupled? What belongs inside each coupled model, and which ports are connected?"
											disabled={isLoading}
											{...field}
										/>
									</FormControl>
									<Dictation
										value={field.value}
										disabled={isLoading}
										onChange={(value) =>
											form.setValue("prompt", value, {
												shouldDirty: true,
												shouldValidate: true,
											})
										}
									/>
									<FormMessage />
								</FormItem>
							)}
						/>
						<div className="flex flex-wrap items-center justify-between gap-4">
							<p className="text-xs text-muted-foreground">
								Structure first. Integration and code are reviewed in the next
								steps.
							</p>
							<Button type="submit" disabled={isLoading}>
								{isLoading ? (
									<Loader2 className="animate-spin" />
								) : (
									<ArrowRight />
								)}
								{isLoading ? "Preparing structure…" : "Create structure"}
							</Button>
						</div>
						{isLoading && (
							<p role="status" className="text-sm text-muted-foreground">
								Generating components, ports and connections. Your description
								is kept here while you wait.
							</p>
						)}
					</form>
				</Form>
				<aside className="min-w-0 space-y-6 text-sm">
					<div>
						<h2 className="font-medium">What helps the description</h2>
						<ul className="mt-3 space-y-3 text-xs leading-6 text-muted-foreground">
							<li>
								<strong className="font-medium text-foreground">
									Components.
								</strong>{" "}
								The atomic and coupled models to include.
							</li>
							<li>
								<strong className="font-medium text-foreground">Ports.</strong>{" "}
								The named inputs and outputs of each model.
							</li>
							<li>
								<strong className="font-medium text-foreground">
									Connections.
								</strong>{" "}
								Which ports connect at each level of the hierarchy.
							</li>
							<li>
								<strong className="font-medium text-foreground">
									Hierarchy.
								</strong>{" "}
								Which components belong inside a coupled model.
							</li>
						</ul>
					</div>
					<div className="rounded-md bg-muted/35 p-4">
						<h2 className="text-xs font-medium">Start with a small example</h2>
						<p className="my-2 text-xs leading-6 text-muted-foreground">
							A Home contains two coupled rooms, each with a switch and a light.
							A general switch connects to both lights through the room inputs.
						</p>
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={isLoading}
							onClick={() => {
								form.setValue("diagramName", "Home", {
									shouldDirty: true,
									shouldValidate: true,
								});
								form.setValue("prompt", example, {
									shouldDirty: true,
									shouldValidate: true,
								});
							}}
						>
							Use this description
						</Button>
					</div>
					<p className="text-xs leading-6 text-muted-foreground">
						Generation uses the provider configured in{" "}
						<Link to="/settings" className="underline underline-offset-4">
							Settings
						</Link>
						. Review each result before saving it to your library.
					</p>
				</aside>
			</div>
		</div>
	);
}
