import { Handle, NodeResizer, Position } from "@xyflow/react";
import { memo } from "react";
import { INTERNAL_PREFIX } from "@/constants";
import type { ReactFlowModelData } from "@/types";
import ModelHeader from "./ModelHeader";

type ModelNodeProps = {
	id: string;
	data: ReactFlowModelData;
	selected: boolean;
};

const getHandlePortIdentifier = (port: { id: string; name: string }) =>
	port.name?.trim() || port.id;

function ModelNode({ id, data, selected }: ModelNodeProps) {
	return (
		<div className="flex flex-col h-full w-full">
			<ModelHeader data={data} id={id} selected={selected} />
			<NodeResizer
				handleClassName="h-2 w-2 z-50 before:content-[''] before:absolute before:inset-[-10px] before:bg-transparent"
				isVisible={selected}
				minHeight={30}
				minWidth={100}
			/>
			<div className="h-full w-full flex flex-col border-border border-2 rounded-b-lg border-solid border-card-foreground">
				<div
					className={`flex relative flex-grow rounded-b-lg ${
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
						{data.inputPorts?.map((port) => {
							const handlePortIdentifier = getHandlePortIdentifier(port);
							return (
								<div
									className="flex flex-row justify-start "
									key={`in-group-${id}:${port.id}`}
								>
									<Handle
										className="relative h-5 w-2 secondary-foreground transform-none top-0"
										id={`${id}:${handlePortIdentifier}`}
										position={Position.Left}
										type="target"
									/>
									{data.modelType === "coupled" ? (
										<Handle
											className="relative h-5 w-2 secondary-foreground transform-none top-0"
											id={`${INTERNAL_PREFIX}${id}:${handlePortIdentifier}`}
											position={Position.Right}
											type="source"
										/>
									) : null}
								</div>
							);
						})}
					</div>
					<div className="flex-grow text-center">&nbsp;</div>
					<div className="flex flex-col justify-evenly  relative text-primary -right-2">
						{data.outputPorts?.map((port) => {
							const handlePortIdentifier = getHandlePortIdentifier(port);
							return (
								<div
									className="flex flex-row justify-start"
									key={`out-group-${id}:${port.id}`}
								>
									{data.modelType === "coupled" ? (
										<Handle
											className="relative h-5 w-2 secondary-foreground transform-none top-0"
											id={`${INTERNAL_PREFIX}${id}:${handlePortIdentifier}`}
											position={Position.Left}
											type="target"
										/>
									) : null}
									<Handle
										className="relative h-5 w-2 secondary-foreground transform-none top-0"
										id={`${id}:${handlePortIdentifier}`}
										position={Position.Right}
										type="source"
									/>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}

export default memo(ModelNode);
