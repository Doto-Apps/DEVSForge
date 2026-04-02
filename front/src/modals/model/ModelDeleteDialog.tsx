import { type ReactNode, useState } from "react";
import { useForm } from "react-hook-form";
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
		defaultValues: {
			confirm: "",
		},
		mode: "onChange",
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
				title: "Model successfully deleted",
				variant: "default",
			});
			await onSubmitSuccess();
			setOpen(false);
			return undefined;
		} catch (error) {
			if (error instanceof Error) {
				toast({
					description: error.message,
					title: "Error deleting model",
					variant: "destructive",
				});

				return error.message;
			}

			return "An error occured";
		}
	};

	return (
		<Dialog onOpenChange={setOpen} open={open}>
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
