import { client } from "@/api/client";
import { Form } from "@/components/form/Form";
import { FormSubmitError } from "@/components/form/FormSubmitError";
import { InputField } from "@/components/form/InputField";
import { Submit } from "@/components/form/Submit";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { zodResolver } from "@hookform/resolvers/zod";
import { TriangleAlertIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const workDeleteSchema = (workspaceName: string) =>
	z.object({
		confirm: z.string().refine((val) => val === workspaceName, {
			message: `Please type "${workspaceName}" to confirm`,
		}),
	});

type Props = {
	workspaceName: string;
	workspaceId: string;
	disclosure?: ReactNode;
	onSubmitSuccess: () => Promise<void> | void;
};

export function WorkspaceDeleteDialog({
	workspaceName,
	workspaceId,
	disclosure,
	onSubmitSuccess,
}: Props) {
	const [open, setOpen] = useState(false);
	const zodSchema = workDeleteSchema(workspaceName);
	const methods = useForm<z.infer<typeof zodSchema>>({
		mode: "onChange",
		resolver: zodResolver(zodSchema),
		defaultValues: {
			confirm: "",
		},
	});
	const { toast } = useToast();

	const onSubmit = async () => {
		try {
			await client.DELETE("/workspace/{id}", {
				params: {
					path: {
						id: workspaceId,
					},
				},
			});
			toast({
				variant: "default",
				title: "Workspace successfully deleted",
			});
			await onSubmitSuccess();
			setOpen(false);
			return undefined;
		} catch (error) {
			if (error instanceof Error) {
				toast({
					variant: "destructive",
					title: "Error deleting workspace",
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
					<DialogTitle>Delete Workspace</DialogTitle>
					<DialogDescription>
						Are you sure to delete the workspace <b>{workspaceName}</b>?
					</DialogDescription>
				</DialogHeader>
				<Alert variant="destructive">
					<TriangleAlertIcon className="size-4" />
					<AlertTitle>Warning</AlertTitle>
					<AlertDescription>
						By removing this workspace, all diagrams in it will be removed
					</AlertDescription>
				</Alert>
				<Form methods={methods} onSubmit={onSubmit}>
					<InputField
						label={`Confirm with ${workspaceName}`}
						control={methods.control}
						name="confirm"
					/>
					<FormSubmitError />
					<DialogFooter>
						<Submit variant="destructive">Delete Workspace</Submit>
					</DialogFooter>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
