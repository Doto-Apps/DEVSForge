import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Minus, Plus } from "lucide-react";

type PortCountEditorProps = {
	label: string;
	count: number;
	onAdd: () => void;
	onRemove: () => void;
	disabled: boolean;
};

export function PortCountEditor({
	label,
	count,
	onAdd,
	onRemove,
	disabled,
}: PortCountEditorProps) {
	return (
		<div className="space-y-1">
			<Label className="text-sm">{label}</Label>
			<div className="flex w-full  border border-input rounded-md overflow-hidden">
				<div className="px-3 py-2 text-sm text-muted-foreground flex-grow flex items-center">
					{count}
				</div>
				<Button
					size="icon"
					variant="ghost"
					onClick={onAdd}
					className="border-l border-input rounded-none hover:bg-accent flex-none"
					disabled={disabled}
				>
					<Plus className="w-4 h-4" />
				</Button>
				<Button
					size="icon"
					variant="ghost"
					onClick={onRemove}
					disabled={disabled}
					className="border-l border-input rounded-none hover:bg-accent flex-none"
				>
					<Minus className="w-4 h-4" />
				</Button>
			</div>
		</div>
	);
}
