import { zodResolver } from "@hookform/resolvers/zod";
import { TriangleAlertIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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

const libDeleteSchema = (libraryName: string) =>
	z.object({
		confirm: z.string().refine((val) => val === libraryName, {
			message: `Please type "${libraryName}" to confirm`,
		}),
	});

type Props = {
	libraryName: string;
	libraryId: string;
	disclosure?: ReactNode;
	onSubmitSuccess: () => Promise<void> | void;
};

export function LibraryDeleteDialog({
	libraryName,
	libraryId,
	disclosure,
	onSubmitSuccess,
}: Props) {
	const [open, setOpen] = useState(false);
	const zodSchema = libDeleteSchema(libraryName);
	const methods = useForm<z.infer<typeof zodSchema>>({
		defaultValues: {
			confirm: "",
		},
		mode: "onChange",
		resolver: zodResolver(zodSchema),
	});
	const { toast } = useToast();

	const onSubmit = async () => {
		try {
			await client.DELETE("/library/{id}", {
				params: {
					path: {
						id: libraryId,
					},
				},
			});
			toast({
				title: "Library successfully deleted",
				variant: "default",
			});
			await onSubmitSuccess();
			setOpen(false);
			return undefined;
		} catch (error) {
			if (error instanceof Error) {
				toast({
					description: error.message,
					title: "Error deleting library",
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
					<DialogTitle>Delete Library</DialogTitle>
					<DialogDescription>
						Are you sure to delete the library <b>{libraryName}</b>?
					</DialogDescription>
				</DialogHeader>
				<Alert variant="destructive">
					<TriangleAlertIcon className="size-4" />
					<AlertTitle>Warning</AlertTitle>
					<AlertDescription>
						By removing the libray, all models in it will be removed
					</AlertDescription>
				</Alert>
				<Form methods={methods} onSubmit={onSubmit}>
					<InputField
						control={methods.control}
						label={`Confirm with ${libraryName}`}
						name="confirm"
					/>
					<FormSubmitError />
					<DialogFooter>
						<Submit variant="destructive">Delete Library</Submit>
					</DialogFooter>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
