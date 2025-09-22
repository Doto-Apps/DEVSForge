import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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

type SelectFieldProps<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
> = Omit<ComponentProps<typeof Select>, "value" | "name"> &
	UseControllerProps<TFieldValues, TName> & {
		label: ReactNode;
		description?: ReactNode;
		placeholder?: string;
	};

export const SelectField = <
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
	control,
	shouldUnregister,
	rules,
	defaultValue,
	label,
	description,
	placeholder,
	children,
	...props
}: SelectFieldProps<TFieldValues, TName>) => {
	const { field } = useController({
		name: props.name,
		control,
		disabled: props.disabled,
		defaultValue,
		shouldUnregister,
		rules: {
			required: props.required,
			// min: props.min,
			// max: props.max,
			// minLength: props.minLength,
			// maxLength: props.maxLength,
			...rules,
		},
	});

	return (
		<FormItem>
			<FormLabel>{label}</FormLabel>
			<FormControl>
				<Select
					{...props}
					name={field.name}
					disabled={field.disabled || props.disabled}
					value={`${field.value ?? ""}`}
					onValueChange={(value) => {
						field.onChange(value);
						props.onValueChange?.(value);
					}}
					onOpenChange={(open) => {
						if (!open) {
							field.onBlur();
						}
					}}
				>
					<SelectTrigger ref={field.ref}>
						<SelectValue placeholder={placeholder} />
					</SelectTrigger>
					<SelectContent>{children}</SelectContent>
				</Select>
			</FormControl>
			{description ? <FormDescription>{description}</FormDescription> : null}
			<FormMessage />
		</FormItem>
	);
};
