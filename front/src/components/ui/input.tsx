import { Minus, Plus } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

const inputClassNames =
	"flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
	({ className, type, ...props }, ref) => {
		const inputRef = React.useRef<HTMLInputElement>(null);
		React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
		const computedStep = Number.parseFloat(`${props.step ?? 1}`);
		const isIntegerStep = Number.isInteger(computedStep);

		return type === "number" ? (
			<div
				className={cn(
					"w-full min-w-0 flex h-10 border border-input rounded-md focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background",
					className,
				)}
			>
				<input
					className={cn(
						"min-w-0 pl-3 appearance-none bg-background flex-grow text-base border-none py-0 h-full focus-visible:ring-0 focus-visible:outline-none rounded-r-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
					)}
					ref={inputRef}
					type={type}
					{...props}
				/>
				<Button
					className="h-full border-l rounded-none px-4"
					onClick={() => {
						if (inputRef.current) {
							if (inputRef.current?.valueAsNumber) {
								inputRef.current.value = `${Math.round((inputRef.current.valueAsNumber + computedStep) * (isIntegerStep ? 1 : 100)) / (isIntegerStep ? 1 : 100)}`;
							}
						}
					}}
					size="icon"
					variant="ghost"
				>
					<Plus className="h-full" />
				</Button>
				<Button
					className="h-full border-l rounded-none px-4"
					onClick={() => {
						if (inputRef.current) {
							if (inputRef.current?.valueAsNumber) {
								inputRef.current.value = `${Math.round((inputRef.current.valueAsNumber - computedStep) * (isIntegerStep ? 1 : 100)) / (isIntegerStep ? 1 : 100)}`;
							}
						}
					}}
					size="icon"
					variant="ghost"
				>
					<Minus className="h-full" />
				</Button>
			</div>
		) : (
			<input
				className={cn(inputClassNames, className)}
				ref={inputRef}
				type={type}
				{...props}
			/>
		);
	},
);
Input.displayName = "Input";

export { Input };
