import React from "react";
import type { components } from "@/api/v1";
import { ModeToggle } from "@/components/mode-toggle";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "../ui/sidebar";
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
	modelId: components["schemas"]["model.Model"]["id"];
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
}) => {
	const lastIndex = breadcrumbs.length - 1;

	return (
		<header
			className={`flex sticky top-0 ${headerBgClass} h-16 shrink-0 items-center gap-2 border-b px-4 ${headerExtraClass}`}
		>
			<SidebarTrigger className="-ml-1" />
			<Separator className="mr-2 h-4" orientation="vertical" />
			<Breadcrumb>
				<BreadcrumbList>
					{breadcrumbs.map((item, index) => (
						<React.Fragment key={item.href + item.label}>
							<BreadcrumbItem
								className={index < lastIndex ? "hidden md:block" : ""}
							>
								{index < lastIndex && item.href ? (
									<BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
								) : (
									<BreadcrumbPage>{item.label}</BreadcrumbPage>
								)}
							</BreadcrumbItem>
							{index < lastIndex ? (
								<BreadcrumbSeparator className="hidden md:block" />
							) : null}
						</React.Fragment>
					))}
				</BreadcrumbList>
			</Breadcrumb>
			<div className="ml-auto px-3 flex items-center gap-2">
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
	);
};

export default NavHeader;
