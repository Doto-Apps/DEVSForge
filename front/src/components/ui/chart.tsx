"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

const THEMES = { dark: ".dark", light: "" } as const;

export type ChartConfig = {
	[key: string]: {
		label?: React.ReactNode;
		icon?: React.ComponentType;
		color?: string;
		theme?: Partial<Record<keyof typeof THEMES, string>>;
	};
};

type ChartContextProps = {
	config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

export function useChart() {
	const context = React.useContext(ChartContext);
	if (!context) {
		throw new Error("useChart must be used within a <ChartContainer />");
	}
	return context;
}

type ChartContainerProps = React.ComponentProps<"div"> & {
	config: ChartConfig;
	children: React.ComponentProps<
		typeof RechartsPrimitive.ResponsiveContainer
	>["children"];
};

export const ChartContainer = React.forwardRef<
	HTMLDivElement,
	ChartContainerProps
>(({ id, className, children, config, ...props }, ref) => {
	const uniqueId = React.useId();
	const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;

	return (
		<ChartContext.Provider value={{ config }}>
			<div
				className={cn(
					"flex aspect-video justify-center text-xs",
					"[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
					"[&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border",
					"[&_.recharts-radial-bar-background-sector]:fill-muted",
					className,
				)}
				data-chart={chartId}
				ref={ref}
				{...props}
			>
				<ChartStyle config={config} id={chartId} />
				<RechartsPrimitive.ResponsiveContainer>
					{children}
				</RechartsPrimitive.ResponsiveContainer>
			</div>
		</ChartContext.Provider>
	);
});

ChartContainer.displayName = "ChartContainer";

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
	const colorEntries = Object.entries(config).filter(
		([, entry]) => entry.theme || entry.color,
	);

	if (!colorEntries.length) return null;

	return (
		<style
			// biome-ignore lint/security/noDangerouslySetInnerHtml: needed
			dangerouslySetInnerHTML={{
				__html: Object.entries(THEMES)
					.map(([theme, prefix]) => {
						const vars = colorEntries
							.map(([key, entry]) => {
								const themeKey = theme as keyof typeof THEMES;
								const color = entry.theme?.[themeKey] ?? entry.color;
								return color ? `  --color-${key}: ${color};` : "";
							})
							.filter(Boolean)
							.join("\n");

						return `${prefix} [data-chart=${id}] {\n${vars}\n}`;
					})
					.join("\n"),
			}}
		/>
	);
}
