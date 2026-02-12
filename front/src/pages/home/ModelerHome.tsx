import NavHeader from "@/components/nav/nav-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetLibraries } from "@/queries/library/useGetLibraries";
import { useGetModels } from "@/queries/model/useGetModels";
import {
	BookOpenText,
	ChevronRight,
	FolderPlus,
	Settings,
	Sparkles,
	Workflow,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
	Label,
	PolarAngleAxis,
	PolarGrid,
	PolarRadiusAxis,
	RadialBar,
	RadialBarChart,
} from "recharts";

type RadialMetricCardProps = {
	title: string;
	description: string;
	value: number;
	valueLabel: string;
	percent: number;
	detail: string;
	color: string;
	loading?: boolean;
};

function RadialMetricCard({
	title,
	description,
	value,
	valueLabel,
	percent,
	detail,
	color,
	loading = false,
}: RadialMetricCardProps) {
	const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
	const chartData = [
		{ metric: "progress", value: safePercent, fill: "var(--color-progress)" },
	];
	const chartConfig = {
		progress: {
			label: title,
			color,
		},
	} satisfies ChartConfig;

	return (
		<Card className="flex h-full flex-col">
			<CardHeader className="pb-0">
				<CardTitle className="text-base">{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className="pt-2 pb-4">
				{loading ? (
					<div className="flex flex-col items-center gap-3">
						<Skeleton className="h-[150px] w-[150px] rounded-full" />
						<Skeleton className="h-3 w-32" />
					</div>
				) : (
					<div className="flex flex-col items-center gap-2">
						<ChartContainer
							config={chartConfig}
							className="mx-auto aspect-square max-h-[170px] w-full"
						>
							<RadialBarChart
								data={chartData}
								startAngle={90}
								endAngle={-270}
								innerRadius={60}
								outerRadius={74}
								barSize={14}
							>
								<PolarAngleAxis
									type="number"
									domain={[0, 100]}
									dataKey="value"
									tick={false}
								/>
								<PolarGrid
									gridType="circle"
									radialLines={false}
									stroke="hsl(var(--muted-foreground))"
									strokeOpacity={0.35}
									strokeWidth={3}
									polarRadius={[67]}
								/>
								<RadialBar dataKey="value" cornerRadius={10} />
								<PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
									<Label
										content={({ viewBox }) => {
											if (viewBox && "cx" in viewBox && "cy" in viewBox) {
												return (
													<text
														x={viewBox.cx}
														y={viewBox.cy}
														textAnchor="middle"
														dominantBaseline="middle"
													>
														<tspan
															x={viewBox.cx}
															y={viewBox.cy}
															className="fill-foreground text-3xl font-semibold"
														>
															{value.toLocaleString()}
														</tspan>
														<tspan
															x={viewBox.cx}
															y={(viewBox.cy || 0) + 20}
															className="fill-muted-foreground text-xs"
														>
															{valueLabel}
														</tspan>
													</text>
												);
											}
											return null;
										}}
									/>
								</PolarRadiusAxis>
							</RadialBarChart>
						</ChartContainer>
						<p className="text-sm font-medium leading-none">{safePercent}%</p>
						<p className="text-xs text-muted-foreground">{detail}</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function formatModelUpdate(value?: string) {
	if (!value) return "Unknown update time";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Unknown update time";
	return date.toLocaleString();
}

function getModelUpdatedAt(model: { [key: string]: unknown }):
	| string
	| undefined {
	if (!("updatedAt" in model)) return undefined;
	const maybe = model.updatedAt;
	return typeof maybe === "string" ? maybe : undefined;
}

export function ModelerHome() {
	const librariesQuery = useGetLibraries();
	const modelsQuery = useGetModels();

	const libraries = librariesQuery.data ?? [];
	const models = modelsQuery.data ?? [];

	const totalLibraries = libraries.length;
	const totalModels = models.length;
	const LIBRARY_GAUGE_MAX = 100;
	const MODEL_GAUGE_MAX = 1000;
	const libraryCoveragePercent =
		(Math.min(totalLibraries, LIBRARY_GAUGE_MAX) / LIBRARY_GAUGE_MAX) * 100;
	const atomicSharePercent =
		(Math.min(totalModels, MODEL_GAUGE_MAX) / MODEL_GAUGE_MAX) * 100;

	const recentModels = [...models]
		.sort((a, b) => {
			const aUpdatedAt = getModelUpdatedAt(a as { [key: string]: unknown });
			const bUpdatedAt = getModelUpdatedAt(b as { [key: string]: unknown });
			const aTime = aUpdatedAt ? new Date(aUpdatedAt).getTime() : 0;
			const bTime = bUpdatedAt ? new Date(bUpdatedAt).getTime() : 0;
			return bTime - aTime;
		})
		.slice(0, 3);

	const modelCountByLibraryId = new Map<string, number>();
	for (const model of models) {
		if (!model.libId) continue;
		modelCountByLibraryId.set(
			model.libId,
			(modelCountByLibraryId.get(model.libId) ?? 0) + 1,
		);
	}

	const librariesPreview = [...libraries]
		.sort((a, b) => {
			const aCount = a.id ? (modelCountByLibraryId.get(a.id) ?? 0) : 0;
			const bCount = b.id ? (modelCountByLibraryId.get(b.id) ?? 0) : 0;
			return bCount - aCount;
		})
		.slice(0, 6);

	return (
		<div className="flex h-screen w-full flex-col">
			<NavHeader
				breadcrumbs={[{ label: "Home" }]}
				showNavActions={false}
				showModeToggle
			/>
			<div className="flex-1 overflow-y-auto">
				<div className="mx-auto w-full max-w-6xl space-y-4 p-4">
					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_16%,_hsl(var(--primary))/0.14,_transparent_44%)]" />
						<CardHeader className="relative py-4">
							<div className="flex flex-wrap items-start justify-between gap-4">
								<div className="space-y-1">
									<Badge className="w-fit">DEVSForge</Badge>
									<CardTitle className="text-2xl">Home</CardTitle>
									<CardDescription className="max-w-2xl">
										Quick overview of your modeling space with direct actions.
									</CardDescription>
								</div>
								<div className="flex flex-wrap gap-2">
									<Button asChild variant="outline" size="sm">
										<Link to="/getting-started">
											<BookOpenText />
											Getting Started
										</Link>
									</Button>
									<Button asChild variant="outline" size="sm">
										<Link to="/how-it-works">
											<Workflow />
											How It Works
										</Link>
									</Button>
								</div>
							</div>
						</CardHeader>
					</Card>

					<div className="grid gap-4 lg:grid-cols-3">
						<div>
							<RadialMetricCard
								title="Libraries"
								description="Visual gauge capped at 100."
								value={totalLibraries}
								valueLabel="Total libraries"
								percent={libraryCoveragePercent}
								detail={`${totalLibraries}/${LIBRARY_GAUGE_MAX}`}
								color="hsl(var(--chart-2))"
								loading={librariesQuery.isLoading}
							/>
						</div>
						<div>
							<RadialMetricCard
								title="Models"
								description="Visual gauge capped at 1000."
								value={totalModels}
								valueLabel="Total models"
								percent={atomicSharePercent}
								detail={`${totalModels}/${MODEL_GAUGE_MAX}`}
								color="hsl(var(--chart-3))"
								loading={modelsQuery.isLoading}
							/>
						</div>
						<Card className="flex flex-col">
							<CardHeader className="pb-0">
								<CardTitle className="text-base">Quick Actions</CardTitle>
								<CardDescription>Most common next steps.</CardDescription>
							</CardHeader>
							<CardContent className="grid flex-1 content-start gap-2 pt-2 pb-4">
								<Button asChild>
									<Link to="/library/new">
										<FolderPlus />
										Create Library
									</Link>
								</Button>
								<Button asChild variant="secondary">
									<Link to="/devs-generator">
										<Sparkles />
										Generate with AI
									</Link>
								</Button>
								<Button asChild variant="outline">
									<Link to="/settings">
										<Settings />
										AI Settings
									</Link>
								</Button>
							</CardContent>
						</Card>
					</div>

					<div className="grid gap-4 lg:grid-cols-2">
						<Card>
							<CardHeader className="pb-0">
								<CardTitle className="text-base">Libraries</CardTitle>
								<CardDescription>
									Top libraries by number of models.
								</CardDescription>
							</CardHeader>
							<CardContent className="pt-2 pb-4">
								{librariesQuery.isLoading ? (
									<div className="space-y-2">
										<Skeleton className="h-10 w-full" />
										<Skeleton className="h-10 w-full" />
										<Skeleton className="h-10 w-full" />
									</div>
								) : librariesPreview.length === 0 ? (
									<p className="text-sm text-muted-foreground">
										No libraries yet. Create your first one.
									</p>
								) : (
									<div className="divide-y rounded-md border">
										{librariesPreview.map((library) => {
											const libraryModels = library.id
												? (modelCountByLibraryId.get(library.id) ?? 0)
												: 0;
											return (
												<div
													key={library.id ?? library.title}
													className="flex items-center justify-between px-4 py-2.5"
												>
													<p className="truncate text-sm font-medium">
														{library.title || "Untitled library"}
													</p>
													<Badge variant="outline">
														{libraryModels} model{libraryModels > 1 ? "s" : ""}
													</Badge>
												</div>
											);
										})}
									</div>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="pb-0">
								<CardTitle className="text-base">Recent Models</CardTitle>
								<CardDescription>Last 3 updated models.</CardDescription>
							</CardHeader>
							<CardContent className="pt-2 pb-4">
								{modelsQuery.isLoading ? (
									<div className="space-y-2">
										<Skeleton className="h-10 w-full" />
										<Skeleton className="h-10 w-full" />
										<Skeleton className="h-10 w-full" />
									</div>
								) : recentModels.length === 0 ? (
									<p className="text-sm text-muted-foreground">
										No models yet. Create a library first or use AI generation.
									</p>
								) : (
									<div className="divide-y rounded-md border">
										{recentModels.map((model) => (
											<div
												key={model.id}
												className="flex items-center justify-between gap-3 px-4 py-2.5"
											>
												<div className="min-w-0">
													<p className="truncate text-sm font-medium">
														{model.name || "Untitled model"}
													</p>
													<p className="mt-1 text-xs text-muted-foreground">
														{model.type || "unknown"} -{" "}
														{formatModelUpdate(
															getModelUpdatedAt(
																model as { [key: string]: unknown },
															),
														)}
													</p>
												</div>
												{model.libId && model.id ? (
													<Button asChild variant="ghost" size="sm">
														<Link
															to={`/library/${model.libId}/model/${model.id}`}
														>
															Open
															<ChevronRight />
														</Link>
													</Button>
												) : (
													<Badge variant="secondary">No link</Badge>
												)}
											</div>
										))}
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}
