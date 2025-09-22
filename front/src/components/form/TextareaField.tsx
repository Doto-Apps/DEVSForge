import { Textarea } from "@/components/ui/textarea";
import type { ComponentProps, ReactNode } from "react";
import {
	type FieldPath,
	type FieldValues,
	type UseControllerProps,
	useController,
} from "react-hook-form";
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
		name: props.name,
		control,
		disabled: props.disabled,
		defaultValue,
		shouldUnregister,
		rules: {
			required: props.required,
			minLength: props.minLength,
			maxLength: props.maxLength,
			...rules,
		},
	});

	return (
		<FormItem>
			<FormLabel>{label}</FormLabel>
			<FormControl>
				<Textarea
					{...props}
					name={field.name}
					onChange={(event) => {
						field.onChange(event);
						props.onChange?.(event);
					}}
					onBlur={(event) => {
						field.onBlur();
						props.onBlur?.(event);
					}}
					ref={field.ref}
					disabled={field.disabled || props.disabled}
					className="ena"
					value={`${field.value ?? ""}`}
				/>
			</FormControl>
			{description ? <FormDescription>{description}</FormDescription> : null}
			<FormMessage />
		</FormItem>
	);
};
