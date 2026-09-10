"use client";

import {
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
} from "react";
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
	headerClassName?: string;
	headerEnd?: ReactNode;
	accent: string | null;
	isActive: boolean;
	onClick: () => void;
	children: ReactNode;
	background?: ReactNode;
	style?: CSSProperties;
	activeStyle?: CSSProperties;
	title?: string;
	minHeightClassName?: string;
}

function useActiveHeightFloor(isActive: boolean) {
	const cardRef = useRef<HTMLButtonElement>(null);
	const [heightFloor, setHeightFloor] = useState<number | null>(null);

	useEffect(() => {
		if (!isActive) {
			setHeightFloor(null);
			return;
		}
		if (typeof ResizeObserver === "undefined") return;

		const card = cardRef.current;
		if (!card) return;
		const observer = new ResizeObserver(([entry]) => {
			const borderBox = Array.isArray(entry.borderBoxSize)
				? entry.borderBoxSize[0]
				: entry.borderBoxSize;
			const height = Math.ceil(
				borderBox?.blockSize ?? entry.contentRect.height,
			);
			setHeightFloor((current) =>
				current === null || height > current ? height : current,
			);
		});
		observer.observe(card);
		return () => observer.disconnect();
	}, [isActive]);

	return { cardRef, heightFloor };
}

export function ChartCard({
	heading,
	headingClassName,
	headingTitle,
	headerClassName,
	headerEnd,
	accent,
	isActive,
	onClick,
	children,
	background,
	style: customStyle,
	activeStyle,
	title,
	minHeightClassName = "min-h-20",
}: ChartCardProps) {
	const isDark = useIsDark();
	const { style, onMouseEnter, onMouseLeave, isHovered } = useCardAccent(
		accent,
		isActive,
		isDark,
	);
	const { cardRef, heightFloor } = useActiveHeightFloor(isActive);

	return (
		<button
			ref={cardRef}
			type="button"
			onClick={onClick}
			style={{
				...style,
				...customStyle,
				...(isActive || isHovered ? activeStyle : {}),
				...(isActive && heightFloor !== null
					? { minHeight: heightFloor }
					: {}),
			}}
			className={cardClass(isActive, isDark, minHeightClassName)}
			title={title}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			<ChartLoadingBackground />
			{background}
			<div className="relative z-10 flex flex-col flex-1">
				<div
					className={[
						"flex items-start justify-between shrink-0",
						headerClassName ?? "mb-1.5",
					]
						.filter(Boolean)
						.join(" ")}
				>
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
