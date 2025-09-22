import { client } from "@/api/client";
import { Form } from "@/components/form/Form";
import { FormSubmitError } from "@/components/form/FormSubmitError";
import { Submit } from "@/components/form/Submit";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { type ReactNode, useState } from "react";
import { useForm } from "react-hook-form";

type Props = {
	modelName: string;
	modelId: string;
	disclosure?: ReactNode;
	onSubmitSuccess: () => Promise<void> | void;
};

export function ModelDeleteDialog({
	modelName,
	modelId,
	disclosure,
	onSubmitSuccess,
}: Props) {
	const [open, setOpen] = useState(false);
	const methods = useForm({
		mode: "onChange",
		defaultValues: {
			confirm: "",
		},
	});
	const { toast } = useToast();

	const onSubmit = async () => {
		try {
			await client.DELETE("/model/{id}", {
				params: {
					path: {
						id: modelId,
					},
				},
			});
			toast({
				variant: "default",
				title: "Model successfully deleted",
			});
			await onSubmitSuccess();
			setOpen(false);
			return undefined;
		} catch (error) {
			if (error instanceof Error) {
				toast({
					variant: "destructive",
					title: "Error deleting model",
					description: error.message,
				});

				return error.message;
			}

			return "An error occured";
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{disclosure}</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Delete Model</DialogTitle>
					<DialogDescription>
						Are you sure to delete the model <b>{modelName}</b>?
					</DialogDescription>
				</DialogHeader>
				<Form methods={methods} onSubmit={onSubmit}>
					<FormSubmitError />
					<DialogFooter>
						<Submit variant="destructive">Delete Model</Submit>
					</DialogFooter>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
