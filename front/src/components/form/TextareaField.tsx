import type { ComponentProps, ReactNode } from "react";
import {
	type FieldPath,
	type FieldValues,
	type UseControllerProps,
	useController,
} from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import {
	FormControl,
	FormDescription,
	FormItem,
	FormLabel,
	FormMessage,
} from "../ui/form";

type TextareaFieldProps<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
> = Omit<ComponentProps<typeof Textarea>, "value" | "name"> &
	UseControllerProps<TFieldValues, TName> & { asNumber?: boolean } & {
		label: ReactNode;
		description?: ReactNode;
	};

export const TextareaField = <
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
	control,
	shouldUnregister,
	rules,
	defaultValue,
	label,
	description,
	...props
}: TextareaFieldProps<TFieldValues, TName>) => {
	const { field } = useController({
		control,
		defaultValue,
		disabled: props.disabled,
		name: props.name,
		rules: {
			maxLength: props.maxLength,
			minLength: props.minLength,
			required: props.required,
			...rules,
		},
		shouldUnregister,
	});

	return (
		<FormItem>
			<FormLabel>{label}</FormLabel>
			<FormControl>
				<Textarea
					{...props}
					className="ena"
					disabled={field.disabled || props.disabled}
					name={field.name}
					onBlur={(event) => {
						field.onBlur();
						props.onBlur?.(event);
					}}
					onChange={(event) => {
						field.onChange(event);
						props.onChange?.(event);
					}}
					ref={field.ref}
					value={`${field.value ?? ""}`}
				/>
			</FormControl>
			{description ? <FormDescription>{description}</FormDescription> : null}
			<FormMessage />
		</FormItem>
	);
};
