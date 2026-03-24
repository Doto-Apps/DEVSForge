import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ReactFlowPort } from "@/types";
import { Plus, Trash2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

type PortEditorProps = {
	label: string;
	ports: ReactFlowPort[];
	onChange: (ports: ReactFlowPort[]) => void;
	disabled: boolean;
	defaultPrefix: string;
};

export function PortEditor({
	label,
	ports,
	onChange,
	disabled,
	defaultPrefix,
}: PortEditorProps) {
	const handleAdd = () => {
		const newName = `${defaultPrefix}${ports.length + 1}`;
		onChange([...ports, { id: uuidv4(), name: newName }]);
	};

	const handleRemove = (index: number) => {
		onChange(ports.filter((_, i) => i !== index));
	};

	const handleNameChange = (index: number, newName: string) => {
		const updated = ports.map((port, i) =>
			i === index ? { ...port, name: newName } : port,
		);
		onChange(updated);
	};

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<Label className="text-sm">{label}</Label>
				<Button
					size="sm"
					variant="outline"
					onClick={handleAdd}
					disabled={disabled}
					className="h-7 px-2"
				>
					<Plus className="w-3 h-3 mr-1" />
					Add
				</Button>
			</div>
			{ports.length === 0 ? (
				<div className="text-xs text-muted-foreground py-2">
					No ports defined
				</div>
			) : (
				<div className="space-y-1">
					{ports.map((port, index) => (
						<div key={port.id} className="flex items-center gap-2">
							<Input
								value={port.name}
								onChange={(e) => handleNameChange(index, e.target.value)}
								disabled={disabled}
								className="h-8 text-sm flex-1"
								placeholder="Port name"
							/>
							<Button
								size="icon"
								variant="ghost"
								onClick={() => handleRemove(index)}
								disabled={disabled}
								className="h-8 w-8 text-muted-foreground hover:text-destructive"
							>
								<Trash2 className="w-4 h-4" />
							</Button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
