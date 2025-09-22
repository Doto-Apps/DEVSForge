"use client";

import {
	Panel,
	type PanelProps,
	useReactFlow,
	useStore,
	useViewport,
} from "@xyflow/react";
import { Info, Maximize, Minus, Plus, ReplaceAll } from "lucide-react";
import * as React from "react";

import { Slider } from "../components/ui/slider";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Toggle } from "./ui/toggle";

type ZoomSliderProps = Omit<PanelProps, "children"> & {
	onOrganizeClick?: () => void;
};

const ZoomSlider = React.forwardRef<HTMLDivElement, ZoomSliderProps>(
	({ className, onOrganizeClick, ...props }) => {
		const { zoom } = useViewport();
		const { zoomTo, zoomIn, zoomOut, fitView } = useReactFlow();

		const { minZoom, maxZoom } = useStore(
			(state) => ({
				minZoom: state.minZoom,
				maxZoom: state.maxZoom,
			}),
			(a, b) => a.minZoom !== b.minZoom || a.maxZoom !== b.maxZoom,
		);

		return (
			<Panel
				className={cn("flex bg-primary-foreground text-foreground", className)}
				{...props}
			>
				<Button
					variant="ghost"
					size="icon"
					onClick={() => zoomOut({ duration: 300 })}
				>
					<Minus className="h-4 w-4" />
				</Button>
				<Slider
					className="w-[140px]"
					value={[zoom]}
					min={minZoom}
					max={maxZoom}
					step={0.01}
					onValueChange={(values) => zoomTo(values[0])}
				/>
				<Button
					variant="ghost"
					size="icon"
					onClick={() => zoomIn({ duration: 300 })}
				>
					<Plus className="h-4 w-4" />
				</Button>
				<Button
					className="min-w-20 tabular-nums"
					variant="ghost"
					onClick={() => zoomTo(1, { duration: 300 })}
				>
					{(100 * zoom).toFixed(0)}%
				</Button>
				<Button
					variant="ghost"
					size="icon"
					onClick={() => fitView({ duration: 300 })}
				>
					<Maximize className="h-4 w-4" />
				</Button>
				{onOrganizeClick && (
					<Button variant="ghost" size="icon" onClick={onOrganizeClick}>
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
