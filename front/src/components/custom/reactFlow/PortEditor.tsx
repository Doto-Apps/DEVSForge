import { Plus, Trash2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ReactFlowPort } from "@/types";

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
					className="h-7 px-2"
					disabled={disabled}
					onClick={handleAdd}
					size="sm"
					variant="outline"
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
						<div className="flex items-center gap-2" key={port.id}>
							<Input
								className="h-8 text-sm flex-1"
								disabled={disabled}
								onChange={(e) => handleNameChange(index, e.target.value)}
								placeholder="Port name"
								value={port.name}
							/>
							<Button
								className="h-8 w-8 text-muted-foreground hover:text-destructive"
								disabled={disabled}
								onClick={() => handleRemove(index)}
								size="icon"
								variant="ghost"
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
