import { useCallback, useMemo, useState } from "react";
import { hexToRgb, lightenHex } from "@/lib/helpers/colorScale/interpolation";

export function useCardAccent(
	accentColor: string | null,
	isActive: boolean,
	isDark: boolean,
) {
	const [hovered, setHovered] = useState(false);

	const style = useMemo<React.CSSProperties>(() => {
		if (!accentColor || (!isActive && !hovered)) return {};
		const s: React.CSSProperties = {
			borderColor: lightenHex(accentColor, 0.45),
		};
		if (isActive) {
			const { r, g, b } = hexToRgb(accentColor);
			s.backgroundColor = isDark
				? `rgba(${r}, ${g}, ${b}, 0.12)`
				: `rgba(${r}, ${g}, ${b}, 0.06)`;
		}
		return s;
	}, [accentColor, isActive, hovered, isDark]);

	const onMouseEnter = useCallback(() => setHovered(true), []);
	const onMouseLeave = useCallback(() => setHovered(false), []);

	return { style, onMouseEnter, onMouseLeave };
}

export function chartHeadingClass(isDark: boolean) {
	return `text-xs font-bold ${isDark ? "text-gray-200" : "text-gray-800/90"}`;
}

export function cardClass(isActive: boolean, isDark: boolean, extra?: string) {
	const state = isActive
		? isDark
			? "bg-white/10"
			: "bg-white/60"
		: isDark
			? "bg-white/5 border-white/10"
			: "bg-white/60 border-gray-200/80";
	return [
		"p-2 rounded cursor-pointer overflow-hidden relative border-2",
		state,
		extra,
	]
		.filter(Boolean)
		.join(" ");
}
