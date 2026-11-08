import React from "react";
import type { components } from "@/api/v1";
import { ModeToggle } from "@/components/mode-toggle";
import { Badge } from "@/components/ui/badge";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { useIntegrations } from "@/hooks/useIntegrations";
import { useOptionalWorkbench } from "@/providers/WorkbenchProvider";
import { SidebarTrigger } from "../ui/sidebar";
import { ModelTabs } from "./model-tabs";
import { NavActions } from "./nav-actions";

type NavHeaderProps = {
	breadcrumbs: {
		label: string;
		href?: string;
	}[];
	showNavActions?: boolean;
	showModeToggle?: boolean;
	headerBgClass?: string;
	headerExtraClass?: string;
	saveFunction?: () => Promise<void>;
	simulateFunction?: () => Promise<void>;
	validateFunction?: () => Promise<void>;
	deployFunction?: () => Promise<void>;
	modelId?: components["schemas"]["model.Model"]["id"];
	modelLanguage?: string;
	integrationId?: string;
	integrationVersion?: string;
};

const NavHeader: React.FC<NavHeaderProps> = ({
	breadcrumbs,
	showNavActions = true,
	showModeToggle = true,
	headerBgClass = "bg-background",
	headerExtraClass = "",
	saveFunction,
	simulateFunction,
	validateFunction,
	deployFunction,
	modelId,
	modelLanguage,
	integrationId,
	integrationVersion,
}) => {
	const { data: integrations } = useIntegrations();
	const workbench = useOptionalWorkbench();
	const label =
		integrations.find(
			(d) => d.id === integrationId && d.version === integrationVersion,
		)?.name ?? modelLanguage;
	const lastIndex = breadcrumbs.length - 1;

	return (
		<div
			className={`sticky top-0 z-20 min-w-0 shrink-0 ${headerBgClass} ${headerExtraClass}`}
		>
			<header className="flex h-12 min-w-0 items-center gap-2 border-b px-3 md:px-4">
				<SidebarTrigger className="-ml-1" />
				{workbench?.storageError && (
					<span
						className="text-xs text-destructive"
						role="alert"
						title={workbench.storageError}
					>
						Local recovery unavailable
					</span>
				)}
				<Separator className="mr-2 h-4" orientation="vertical" />
				<Breadcrumb className="min-w-0 flex-1">
					<BreadcrumbList className="flex-nowrap">
						{breadcrumbs.map((item, index) => (
							<React.Fragment key={item.href + item.label}>
								<BreadcrumbItem
									className={
										index < lastIndex
											? "hidden min-w-0 md:inline-flex"
											: "min-w-0"
									}
								>
									{index < lastIndex && item.href ? (
										<BreadcrumbLink className="truncate" href={item.href}>
											{item.label}
										</BreadcrumbLink>
									) : (
										<BreadcrumbPage className="truncate">
											{item.label}
										</BreadcrumbPage>
									)}
								</BreadcrumbItem>
								{index < lastIndex ? (
									<BreadcrumbSeparator className="hidden md:block" />
								) : null}
							</React.Fragment>
						))}
					</BreadcrumbList>
				</Breadcrumb>
				{modelLanguage && (
					<Badge
						className="hidden shrink-0 xl:inline-flex"
						title="Model language"
						variant="secondary"
					>
						{label}
					</Badge>
				)}
				<div className="ml-auto flex shrink-0 items-center gap-2">
					{showNavActions ? (
						<NavActions
							deployFunction={deployFunction}
							modelId={modelId}
							saveFunction={saveFunction}
							simulateFunction={simulateFunction}
							validateFunction={validateFunction}
						/>
					) : null}
					{showModeToggle && <ModeToggle />}
				</div>
			</header>
			{workbench?.tabs.length ? <ModelTabs /> : null}
		</div>
	);
};

export default NavHeader;
