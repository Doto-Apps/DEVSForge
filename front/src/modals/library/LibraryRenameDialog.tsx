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

const libRenameSchema = (libraryName: string) =>
	z.object({
		name: z.string(),
	});

type Props = {
	libraryName: string;
	libraryId: string;
	disclosure?: ReactNode;
	onSubmitSuccess: () => Promise<void> | void;
};

export function LibraryRenameDialog({
	libraryName,
	libraryId,
	disclosure,
	onSubmitSuccess,
}: Props) {
	const [open, setOpen] = useState(false);
	const zodSchema = libRenameSchema(libraryName);
	const methods = useForm<z.infer<typeof zodSchema>>({
		defaultValues: {
			name: "",
		},
		mode: "onChange",
		resolver: zodResolver(zodSchema),
	});
	const { toast } = useToast();

	const onSubmit = async () => {
		try {
			await client.PATCH("/library/{id}", {
				body: {
					title: methods.getValues().name,
				},
				params: {
					path: {
						id: libraryId,
					},
				},
			});
			toast({
				title: "Library successfully renamed",
				variant: "default",
			});
			await onSubmitSuccess();
			setOpen(false);
			return undefined;
		} catch (error) {
			if (error instanceof Error) {
				toast({
					description: error.message,
					title: "Error renaming library",
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
					<DialogTitle>Rename Library</DialogTitle>
				</DialogHeader>
				<Form methods={methods} onSubmit={onSubmit}>
					<InputField
						control={methods.control}
						label={`New name for ${libraryName}`}
						name="name"
					/>
					<FormSubmitError />
					<DialogFooter>
						<Submit variant="default">Rename Library</Submit>
					</DialogFooter>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
