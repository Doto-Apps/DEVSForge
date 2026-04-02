import { LoaderIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { useFormState } from "react-hook-form";
import { Button } from "@/components/ui/button";

type SubmitProps = ComponentProps<typeof Button>;

export const Submit = ({ disabled, children, ...rest }: SubmitProps) => {
	const { isValid, isSubmitting, isValidating } = useFormState();

	return (
		<Button
			{...rest}
			disabled={disabled || !isValid || isValidating || isSubmitting}
			type="submit"
		>
			{isSubmitting ? <LoaderIcon className="animate animate-spin" /> : null}
			{children}
		</Button>
	);
};
