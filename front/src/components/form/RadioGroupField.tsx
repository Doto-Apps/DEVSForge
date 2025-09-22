import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
		name: props.name,
		control,
		disabled: props.disabled,
		defaultValue,
		shouldUnregister,
		rules,
	});

	return (
		<FormItem>
			<FormLabel>{label}</FormLabel>
			<FormControl>
				<RadioGroup
					{...props}
					value={field.value}
					onValueChange={(value) => field.onChange(value)}
				>
					{options.map((option) => (
						<FormItem
							key={option.value}
							className="flex items-center space-x-3 space-y-0"
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
