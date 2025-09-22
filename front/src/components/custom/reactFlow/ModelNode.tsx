import { INTERNAL_PREFIX } from "@/constants";
import type { ReactFlowModelData } from "@/types";
import { Handle, NodeResizer, Position } from "@xyflow/react";
import { memo } from "react";
import ModelHeader from "./ModelHeader";

type ModelNodeProps = {
	id: string;
	data: ReactFlowModelData;
	selected: boolean;
};

function ModelNode({ id, data, selected }: ModelNodeProps) {
	return (
		<div className="flex flex-col h-full w-full">
			<ModelHeader selected={selected} data={data} id={id} />
			<NodeResizer
				isVisible={selected}
				minWidth={100}
				minHeight={30}
				handleClassName="h-2 w-2 z-50 before:content-[''] before:absolute before:inset-[-10px] before:bg-transparent"
			/>
			<div className="h-full w-full flex flex-col border-border border rounded-lg border-solid ">
				<div
					className={`flex relative flex-grow ${
						!data.reactFlowModelGraphicalData?.bodyBackgroundColor
							? "bg-card"
							: ""
					}`}
					style={
						data.reactFlowModelGraphicalData?.bodyBackgroundColor
							? {
									backgroundColor:
										data.reactFlowModelGraphicalData.bodyBackgroundColor,
								}
							: undefined
					}
				>
					<div className="flex flex-col justify-evenly relative -left-2 text-primary">
						{data.inputPorts?.map((port: { id: string }) => (
							<div
								key={`in-group-${id}:${port.id}`}
								className="flex flex-row justify-start "
							>
								<Handle
									className="relative h-5 w-2 secondary-foreground transform-none top-0"
									type="target"
									id={`${id}:${port.id}`}
									position={Position.Left}
								/>
								{data.modelType === "coupled" ? (
									<Handle
										className="relative h-5 w-2 secondary-foreground transform-none top-0"
										type="source"
										id={`${INTERNAL_PREFIX}${id}:${port.id}`}
										position={Position.Right}
									/>
								) : null}
							</div>
						))}
					</div>
					<div className="flex-grow text-center">&nbsp;</div>
					<div className="flex flex-col justify-evenly  relative text-primary -right-2">
						{data.outputPorts?.map((port: { id: string }) => (
							<div
								key={`out-group-${id}:${port.id}`}
								className="flex flex-row justify-start"
							>
								{data.modelType === "coupled" ? (
									<Handle
										className="relative h-5 w-2 secondary-foreground transform-none top-0"
										type="target"
										id={`${INTERNAL_PREFIX}${id}:${port.id}`}
										position={Position.Left}
									/>
								) : null}
								<Handle
									className="relative h-5 w-2 secondary-foreground transform-none top-0"
									type="source"
									id={`${id}:${port.id}`}
									position={Position.Right}
								/>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

export default memo(ModelNode);
