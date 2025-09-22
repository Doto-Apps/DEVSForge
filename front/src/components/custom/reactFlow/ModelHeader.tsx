import type { ReactFlowModelData } from "@/types";
import clsx from "clsx";
import { memo } from "react";

type ModelNodeProps = {
	data: ReactFlowModelData;
	selected: boolean;
	id: string;
};

function ModelHeader({ data, selected, id }: ModelNodeProps) {
	return (
		<div
			className={clsx(
				"h-10 border-border rounded-t-lg flex flex-col justify-center items-center",
				!data.reactFlowModelGraphicalData?.headerBackgroundColor &&
					"bg-card-foreground",
				!data.reactFlowModelGraphicalData?.headerTextColor &&
					"text-primary-foreground",
			)}
			style={{
				...(data.reactFlowModelGraphicalData?.headerBackgroundColor
					? {
							backgroundColor:
								data.reactFlowModelGraphicalData.headerBackgroundColor,
						}
					: {}),
				...(data.reactFlowModelGraphicalData?.headerTextColor
					? { color: data.reactFlowModelGraphicalData.headerTextColor }
					: {}),
			}}
		>
			<div className={"h-5"}>{data.label}</div>
		</div>
	);
}

export default memo(ModelHeader);
