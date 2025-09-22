import type { ReactNode } from "react";
import {
	type FieldValues,
	FormProvider,
	type UseFormReturn,
} from "react-hook-form";

// biome-ignore lint/suspicious/noConfusingVoidType: We need void for no return
type OnSubmitReturn = string | null | undefined | void;

type FormProps<TFieldValues extends FieldValues> = {
	methods: UseFormReturn<TFieldValues>;
	onSubmit: (values: TFieldValues) => OnSubmitReturn | Promise<OnSubmitReturn>;
	children: ReactNode;
	className?: string;
};

export const Form = <TFieldValues extends FieldValues>({
	onSubmit,
	methods,
	children,
	className,
}: FormProps<TFieldValues>) => {
	const handleSubmit = methods.handleSubmit(async (values) => {
		try {
			const result = await onSubmit(values);

			if (result) {
				methods.setError("root.submit", {
					type: "custom",
					message: result,
				});
			}
		} catch (error) {
			if (error instanceof Error) {
				methods.setError("root.submit", {
					type: "custom",
					message: error.message,
				});
			} else {
				methods.setError("root.submit", {
					type: "custom",
					message: "An error occured",
				});
			}
		}
	});

	return (
		<FormProvider {...methods}>
			<form
				className={className ?? "space-y-8"}
				onSubmit={async (event) => {
					event.preventDefault();
					event.stopPropagation();
					await handleSubmit(event);
				}}
			>
				{children}
			</form>
		</FormProvider>
	);
};
