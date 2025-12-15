"use client";

import { ModelCodeEditor } from "@/components/custom/ModelCodeEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useGenerateModelCode } from "@/hooks/useGenerateModelCode";
import { useToast } from "@/hooks/use-toast";
import type { CodeGenerationPanelProps } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	CheckCircle2,
	ChevronRight,
	Code2,
	Loader2,
	Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const promptSchema = z.object({
	prompt: z.string().min(5, {
		message: "Prompt must be at least 5 characters.",
	}),
});

export function CodeGenerationPanel({
	diagram,
	currentModelIndex,
	onCodeGenerated,
	onModelValidated,
	onCodeChange,
}: CodeGenerationPanelProps) {
	const { generateCode, isLoading, error } = useGenerateModelCode();
	const { toast } = useToast();
	const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

	// Only atomic models need code generation
	const atomicModels = diagram.models.filter((m) => m.type === "atomic");
	const coupledModels = diagram.models.filter((m) => m.type === "coupled");
	const currentModel = atomicModels[currentModelIndex];

	const form = useForm<z.infer<typeof promptSchema>>({
		resolver: zodResolver(promptSchema),
		defaultValues: {
			prompt: "",
		},
	});

	useEffect(() => {
		if (currentModel) {
			setSelectedModelId(currentModel.id);
		}
	}, [currentModel]);

	// Get code from models that current model depends on
	const getPreviousModelsCode = (): string => {
		const dependencyIds = currentModel?.dependencies ?? [];
		const dependencyCodes = diagram.models
			.filter((m) => dependencyIds.includes(m.id) && m.code)
			.map((m) => `# === ${m.name} ===\n${m.code}`)
			.join("\n\n");

		return dependencyCodes || "# No previous models";
	};

	const handleGenerateCode = async (values: z.infer<typeof promptSchema>) => {
		if (!currentModel) return;

		const code = await generateCode({
			modelName: currentModel.name,
			modelType: currentModel.type,
			previousModelsCode: getPreviousModelsCode(),
			userPrompt: values.prompt,
		});

		if (code) {
			onCodeGenerated(currentModel.id, code);
			toast({
				title: "Code generated successfully",
				description: `Code for ${currentModel.name} has been generated.`,
			});
		} else if (error) {
			toast({
				title: "Generation error",
				description: error,
				variant: "destructive",
			});
		}
	};

	const handleValidateModel = () => {
		if (currentModel?.code) {
			onModelValidated();
			toast({
				title: "Model validated",
				description: `${currentModel.name} has been validated. Moving to next model.`,
			});
		}
	};

	const selectedModel =
		diagram.models.find((m) => m.id === selectedModelId) ?? currentModel;

	const isCurrentModel = selectedModelId === currentModel?.id;
	const isSelectedAtomic = selectedModel?.type === "atomic";
	const canValidate = currentModel?.codeGenerated && currentModel?.code;
	const isComplete = currentModelIndex >= atomicModels.length;

	if (isComplete) {
		return (
			<div className="h-full flex flex-col items-center justify-center p-8">
				<CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
				<h2 className="text-2xl font-bold mb-2">Generation complete!</h2>
				<p className="text-muted-foreground text-center max-w-md mb-6">
					All models have been generated. You can now save them to your library.
				</p>
			</div>
		);
	}

	return (
		<div className="h-full flex">
			{/* Left panel: models list with progress */}
			<div className="w-72 border-r bg-muted/30 flex flex-col">
				<div className="p-4 border-b">
					<h3 className="font-semibold">Progress</h3>
					<p className="text-xs text-muted-foreground mt-1">
						{currentModelIndex} / {atomicModels.length} atomic models generated
					</p>
					<div className="w-full bg-muted rounded-full h-2 mt-2">
						<div
							className="bg-primary h-2 rounded-full transition-all"
							style={{
								width: `${(currentModelIndex / atomicModels.length) * 100}%`,
							}}
						/>
					</div>
				</div>

				<div className="flex-1 overflow-auto">
					<div className="p-2 space-y-1">
						{/* Atomic models - need code generation */}
						<div className="text-xs text-muted-foreground px-2 py-1 font-medium">
							Atomic Models ({atomicModels.length})
						</div>
						{atomicModels.map((model, index) => {
							const isGenerated = model.codeGenerated;
							const isCurrent = index === currentModelIndex;
							const isSelected = model.id === selectedModelId;

							return (
								<button
									key={model.id}
									type="button"
									onClick={() => setSelectedModelId(model.id)}
									className={`w-full text-left p-2 rounded-md transition-colors flex items-center gap-2 ${
										isSelected
											? "bg-accent"
											: "hover:bg-accent/50"
									}`}
								>
									<span className="flex-shrink-0">
										{isGenerated ? (
											<CheckCircle2 className="w-4 h-4 text-green-500" />
										) : isCurrent ? (
											<ChevronRight className="w-4 h-4 text-primary" />
										) : (
											<Code2 className="w-4 h-4 text-muted-foreground" />
										)}
									</span>
									<span
										className={`flex-1 text-sm truncate ${
											isCurrent ? "font-medium" : ""
										}`}
									>
										{model.name}
									</span>
									<span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
										A
									</span>
								</button>
							);
						})}

						{/* Coupled models - no code needed */}
						{coupledModels.length > 0 && (
							<>
								<div className="text-xs text-muted-foreground px-2 py-1 font-medium mt-3">
									Coupled Models ({coupledModels.length}) - No code
								</div>
								{coupledModels.map((model) => {
									const isSelected = model.id === selectedModelId;

									return (
										<button
											key={model.id}
											type="button"
											onClick={() => setSelectedModelId(model.id)}
											className={`w-full text-left p-2 rounded-md transition-colors flex items-center gap-2 ${
												isSelected
													? "bg-accent"
													: "hover:bg-accent/50"
											}`}
										>
											<span className="flex-shrink-0">
												<CheckCircle2 className="w-4 h-4 text-green-500" />
											</span>
											<span className="flex-1 text-sm truncate">
												{model.name}
											</span>
											<span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
												C
											</span>
										</button>
									);
								})}
							</>
						)}
					</div>
				</div>
			</div>

			{/* Center panel: prompt generator */}
			<div className="w-80 border-r p-4 flex flex-col">
				<Card className="mb-4">
					<CardHeader className="pb-2">
						<CardTitle className="text-lg flex items-center gap-2">
							<Code2 className="w-5 h-5" />
						{selectedModel?.name ?? "Select a model"}
						</CardTitle>
					</CardHeader>
					<CardContent className="text-sm text-muted-foreground">
						<div className="space-y-1">
							<p>
								<strong>Type:</strong> {selectedModel?.type}
							</p>
							{selectedModel?.ports.in.length ? (
								<p>
									<strong>Inputs:</strong>{" "}
									{selectedModel.ports.in.join(", ")}
								</p>
							) : null}
							{selectedModel?.ports.out.length ? (
								<p>
									<strong>Outputs:</strong>{" "}
									{selectedModel.ports.out.join(", ")}
								</p>
							) : null}
							{selectedModel?.dependencies.length ? (
								<p className="text-orange-600 dark:text-orange-400">
									<strong>Dependencies:</strong>{" "}
									{selectedModel.dependencies.join(", ")}
								</p>
							) : null}
						</div>
					</CardContent>
				</Card>

				{isCurrentModel && isSelectedAtomic && (
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(handleGenerateCode)}
							className="flex-1 flex flex-col"
						>
							<FormField
								control={form.control}
								name="prompt"
								render={({ field }) => (
									<FormItem className="flex-1 flex flex-col">
										<FormLabel>
											Describe the model behavior
										</FormLabel>
										<FormControl>
											<Textarea
												placeholder={`Describe how ${selectedModel?.name} should behave. e.g., This model should alternate between ON and OFF states every 10 seconds...`}
												className="flex-1 resize-none min-h-[150px]"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<div className="space-y-2 mt-4">
								<Button
									type="submit"
									className="w-full"
									disabled={isLoading}
								>
									{isLoading ? (
										<>
											<Loader2 className="w-4 h-4 mr-2 animate-spin" />
											Generating...
										</>
									) : (
										<>
											<Sparkles className="w-4 h-4 mr-2" />
											{currentModel?.codeGenerated
												? "Regenerate"
												: "Generate Code"}
										</>
									)}
								</Button>

								{canValidate && (
									<Button
										type="button"
										variant="outline"
										className="w-full"
										onClick={handleValidateModel}
									>
										<CheckCircle2 className="w-4 h-4 mr-2" />
										Validate & Continue
									</Button>
								)}
							</div>
						</form>
					</Form>
				)}

				{!isCurrentModel && selectedModel?.codeGenerated && isSelectedAtomic && (
					<div className="flex-1 flex items-center justify-center">
						<p className="text-sm text-muted-foreground text-center">
							This model has already been generated. You can view and edit
							its code on the right.
						</p>
					</div>
				)}

				{/* Coupled models don't have code */}
				{!isSelectedAtomic && (
					<div className="flex-1 flex items-center justify-center">
						<div className="text-center">
							<p className="text-sm text-muted-foreground">
								Coupled models don't require code generation.
							</p>
							<p className="text-xs text-muted-foreground mt-2">
								Components: {selectedModel?.components?.join(", ") || "None"}
							</p>
						</div>
					</div>
				)}
			</div>

			{/* Right panel: code editor */}
			<div className="flex-1 flex flex-col">
				<div className="p-2 border-b bg-muted/30 flex items-center justify-between">
					<span className="text-sm font-medium">
						{isSelectedAtomic ? `Code: ${selectedModel?.name}` : `Structure: ${selectedModel?.name}`}
					</span>
					{isSelectedAtomic && selectedModel?.codeGenerated && (
						<span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
							<CheckCircle2 className="w-3 h-3" />
							Generated
						</span>
					)}
					{!isSelectedAtomic && (
						<span className="text-xs text-purple-600 dark:text-purple-400">
							Coupled - No code
						</span>
					)}
				</div>
				<div className="flex-1">
					{isSelectedAtomic && selectedModel?.code ? (
						<ModelCodeEditor
							code={selectedModel.code}
							onCodeChange={(newCode) =>
								onCodeChange(selectedModel.id, newCode)
							}
							modelId={selectedModel.id}
						/>
					) : isSelectedAtomic ? (
						<div className="h-full flex items-center justify-center bg-muted/20">
							<p className="text-muted-foreground">
								{isCurrentModel
									? "Use the form to generate the code"
									: "No code available for this model"}
							</p>
						</div>
					) : (
						<div className="h-full flex flex-col items-center justify-center bg-muted/20 p-8">
							<p className="text-lg font-medium mb-4">Coupled Model Structure</p>
							<div className="text-sm text-muted-foreground space-y-2">
								<p><strong>Components:</strong></p>
								<ul className="list-disc list-inside">
									{selectedModel?.components?.map((comp) => (
										<li key={comp}>{comp}</li>
									)) || <li>No components defined</li>}
								</ul>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
