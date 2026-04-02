import type { ComponentProps, ReactNode } from "react";
import {
	type FieldPath,
	type FieldValues,
	type UseControllerProps,
	useController,
} from "react-hook-form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	FormControl,
	FormDescription,
	FormItem,
	FormLabel,
	FormMessage,
} from "../ui/form";

type RadioOption = {
	value: string;
	label: ReactNode;
};

type RadioGroupFieldProps<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
> = Omit<
	ComponentProps<typeof RadioGroup>,
	"value" | "name" | "onValueChange"
> &
	UseControllerProps<TFieldValues, TName> & {
		label: ReactNode;
		description?: ReactNode;
		options: RadioOption[];
	};

export const RadioGroupField = <
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
	control,
	shouldUnregister,
	rules,
	defaultValue,
	label,
	description,
	options,
	...props
}: RadioGroupFieldProps<TFieldValues, TName>) => {
	const { field } = useController({
		control,
		defaultValue,
		disabled: props.disabled,
		name: props.name,
		rules,
		shouldUnregister,
	});

	return (
		<FormItem>
			<FormLabel>{label}</FormLabel>
			<FormControl>
				<RadioGroup
					{...props}
					onValueChange={(value) => field.onChange(value)}
					value={field.value}
				>
					{options.map((option) => (
						<FormItem
							className="flex items-center space-x-3 space-y-0"
							key={option.value}
						>
							<FormControl>
								<RadioGroupItem value={option.value} />
							</FormControl>
							<FormLabel className="font-normal">{option.label}</FormLabel>
						</FormItem>
					))}
				</RadioGroup>
			</FormControl>
			{description ? <FormDescription>{description}</FormDescription> : null}
			<FormMessage />
		</FormItem>
	);
};
