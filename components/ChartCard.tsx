"use client";

import type { ReactNode } from "react";
import { ChartLoadingBackground } from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";
import {
	cardClass,
	chartHeadingClass,
	useCardAccent,
} from "@/lib/hooks/useCardAccent";

interface ChartCardProps {
	heading: ReactNode;
	headingClassName?: string;
	headingTitle?: string;
	headerEnd?: ReactNode;
	accent: string | null;
	isActive: boolean;
	onClick: () => void;
	children: ReactNode;
	title?: string;
	minHeightClassName?: string;
}

export function ChartCard({
	heading,
	headingClassName,
	headingTitle,
	headerEnd,
	accent,
	isActive,
	onClick,
	children,
	title,
	minHeightClassName = "min-h-20",
}: ChartCardProps) {
	const isDark = useIsDark();
	const { style, onMouseEnter, onMouseLeave } = useCardAccent(
		accent,
		isActive,
		isDark,
	);

	return (
		<button
			type="button"
			onClick={onClick}
			style={style}
			className={cardClass(isActive, isDark, minHeightClassName)}
			title={title}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			<ChartLoadingBackground />
			<div className="relative z-10 flex flex-col flex-1">
				<div className="flex items-start justify-between mb-1.5 shrink-0">
					<h3
						className={[chartHeadingClass(isDark), headingClassName]
							.filter(Boolean)
							.join(" ")}
						title={headingTitle}
					>
						{heading}
					</h3>
					{headerEnd}
				</div>
				{children}
			</div>
		</button>
	);
}
