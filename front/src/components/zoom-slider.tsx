"use client";

import {
	Panel,
	type PanelProps,
	useReactFlow,
	useStore,
	useViewport,
} from "@xyflow/react";
import { Maximize, Minus, Plus, ReplaceAll } from "lucide-react";
import * as React from "react";

import { Slider } from "../components/ui/slider";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

type ZoomSliderProps = Omit<PanelProps, "children"> & {
	onOrganizeClick?: () => void;
};

const ZoomSlider = React.forwardRef<HTMLDivElement, ZoomSliderProps>(
	({ className, onOrganizeClick, ...props }) => {
		const { zoom } = useViewport();
		const { zoomTo, zoomIn, zoomOut, fitView } = useReactFlow();

		const { minZoom, maxZoom } = useStore(
			(state) => ({
				maxZoom: state.maxZoom,
				minZoom: state.minZoom,
			}),
			(a, b) => a.minZoom !== b.minZoom || a.maxZoom !== b.maxZoom,
		);

		return (
			<Panel
				className={cn("flex bg-primary-foreground text-foreground", className)}
				{...props}
			>
				<Button
					onClick={() => zoomOut({ duration: 300 })}
					size="icon"
					variant="ghost"
				>
					<Minus className="h-4 w-4" />
				</Button>
				<Slider
					className="w-[140px]"
					max={maxZoom}
					min={minZoom}
					onValueChange={(values) => zoomTo(values[0])}
					step={0.01}
					value={[zoom]}
				/>
				<Button
					onClick={() => zoomIn({ duration: 300 })}
					size="icon"
					variant="ghost"
				>
					<Plus className="h-4 w-4" />
				</Button>
				<Button
					className="min-w-20 tabular-nums"
					onClick={() => zoomTo(1, { duration: 300 })}
					variant="ghost"
				>
					{(100 * zoom).toFixed(0)}%
				</Button>
				<Button
					onClick={() => fitView({ duration: 300 })}
					size="icon"
					variant="ghost"
				>
					<Maximize className="h-4 w-4" />
				</Button>
				{onOrganizeClick && (
					<Button onClick={onOrganizeClick} size="icon" variant="ghost">
						<ReplaceAll className="h-4 w-4" />
					</Button>
				)}
			</Panel>
		);
	},
);

// Ajout d'une condition pour éviter de passer une ref inutile
ZoomSlider.displayName = "ZoomSlider";

export { ZoomSlider };
