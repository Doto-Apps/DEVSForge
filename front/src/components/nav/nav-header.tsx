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
import React from "react";
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
};

const NavHeader: React.FC<NavHeaderProps> = ({
	breadcrumbs,
	showNavActions = true,
	showModeToggle = true,
	headerBgClass = "bg-background",
	headerExtraClass = "",
	saveFunction,
	simulateFunction,
}) => {
	const lastIndex = breadcrumbs.length - 1;

	return (
		<header
			className={`flex sticky top-0 ${headerBgClass} h-16 shrink-0 items-center gap-2 border-b px-4 ${headerExtraClass}`}
		>
			<SidebarTrigger className="-ml-1" />
			<Separator orientation="vertical" className="mr-2 h-4" />
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
				{showNavActions && (
					<NavActions
						saveFunction={saveFunction}
						simulateFunction={simulateFunction}
					/>
				)}
				{showModeToggle && <ModeToggle />}
			</div>
		</header>
	);
};

export default NavHeader;
