import { Input } from "@/components/ui/input";
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

type InputFieldProps<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
> = Omit<ComponentProps<typeof Input>, "value" | "name"> &
	UseControllerProps<TFieldValues, TName> & { asNumber?: boolean } & {
		label: ReactNode;
		description?: ReactNode;
	};

export const InputField = <
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
	control,
	shouldUnregister,
	rules,
	asNumber,
	defaultValue,
	label,
	description,
	...props
}: InputFieldProps<TFieldValues, TName>) => {
	const { field } = useController({
		name: props.name,
		control,
		disabled: props.disabled,
		defaultValue,
		shouldUnregister,
		rules: {
			required: props.required,
			min: props.min,
			max: props.max,
			minLength: props.minLength,
			maxLength: props.maxLength,
			...rules,
		},
	});

	return (
		<FormItem>
			<FormLabel>{label}</FormLabel>
			<FormControl>
				<Input
					{...props}
					name={field.name}
					onChange={(event) => {
						if (asNumber) {
							if (event.target.value !== "") {
								field.onChange(+event.target.value);
							} else {
								field.onChange(null);
							}
						} else {
							field.onChange(event);
						}
						props.onChange?.(event);
					}}
					onBlur={(event) => {
						if (asNumber) {
							if (Number.isNaN(event.target.valueAsNumber)) {
								field.onChange(null);
								event.target.value = "";
							}
						}
						field.onBlur();
						props.onBlur?.(event);
					}}
					ref={field.ref}
					disabled={field.disabled || props.disabled}
					value={`${field.value ?? ""}`}
				/>
			</FormControl>
			{description ? <FormDescription>{description}</FormDescription> : null}
			<FormMessage />
		</FormItem>
	);
};
