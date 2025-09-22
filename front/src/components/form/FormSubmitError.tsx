import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TriangleAlertIcon } from "lucide-react";
import { useFormState } from "react-hook-form";

export const FormSubmitError = () => {
	const { errors } = useFormState();

	if (errors.root?.message) {
		return (
			<Alert variant="destructive">
				<TriangleAlertIcon className="h-4 w-4" />
				<AlertTitle>An internal error occured</AlertTitle>
				<AlertDescription>{errors.root.message}</AlertDescription>
			</Alert>
		);
	}

	if (errors.root?.submit?.message) {
		return (
			<Alert variant="destructive">
				<TriangleAlertIcon className="h-4 w-4" />
				<AlertTitle>An error occured during submit</AlertTitle>
				<AlertDescription>{errors.root.submit.message}</AlertDescription>
			</Alert>
		);
	}
};
