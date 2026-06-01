import type { CSSProperties } from "react";

export function panelTheme(isDark: boolean) {
	return {
		panel: isDark
			? "border-white/10 text-gray-100"
			: "border-white/40 text-gray-800",
		section: isDark ? "bg-white/5" : "bg-white/20",
		border: isDark ? "border-white/10" : "border-white/20",
		text: isDark ? "text-gray-300" : "text-gray-600",
		textMuted: isDark ? "text-gray-500" : "text-gray-400",
		hover: isDark ? "hover:bg-white/10" : "hover:bg-white/20",
		active: isDark ? "bg-white/15" : "bg-white/60",
		input: isDark
			? "bg-white/5 border-white/10 text-gray-300 placeholder:text-gray-600"
			: "bg-white/10 border-white/30 text-gray-500",
		heading: isDark ? "text-gray-100" : "text-gray-800",
	} as const;
}

export function glassStyle(isDark: boolean): CSSProperties {
	return isDark
		? {
				// More transparent so the map reads through the pane like real glass
				background:
					"linear-gradient(145deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 30%, rgba(8,8,20,0.30) 100%)",
				backdropFilter:
					"blur(20px) saturate(190%) brightness(1.12) contrast(1.06)",
				WebkitBackdropFilter:
					"blur(20px) saturate(190%) brightness(1.12) contrast(1.06)",
				boxShadow: [
					// bright top + left edges catch the light, dark bottom for thickness
					"inset 0 1px 0 rgba(255,255,255,0.30)",
					"inset 1px 0 0 rgba(255,255,255,0.18)",
					"inset -1px 0 0 rgba(0,0,0,0.12)",
					"inset 0 -1px 0 rgba(0,0,0,0.25)",
					"0 20px 60px rgba(0,0,0,0.55)",
					"0 4px 16px rgba(0,0,0,0.35)",
					"0 0 0 0.5px rgba(255,255,255,0.14)",
				].join(", "),
				border: "1px solid rgba(255,255,255,0.20)",
			}
		: {
				// Lighter, more see-through tint while keeping text legible
				background:
					"linear-gradient(145deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.28) 35%, rgba(190,205,230,0.18) 100%)",
				backdropFilter:
					"blur(20px) saturate(170%) brightness(1.12) contrast(1.03)",
				WebkitBackdropFilter:
					"blur(20px) saturate(170%) brightness(1.12) contrast(1.03)",
				boxShadow: [
					"inset 0 1px 0 rgba(255,255,255,0.85)",
					"inset 1px 0 0 rgba(255,255,255,0.6)",
					"inset -1px 0 0 rgba(0,0,0,0.04)",
					"inset 0 -1px 0 rgba(0,0,0,0.06)",
					"0 20px 60px rgba(0,0,0,0.16)",
					"0 4px 16px rgba(0,0,0,0.10)",
					"0 0 0 0.5px rgba(255,255,255,0.65)",
				].join(", "),
				border: "1px solid rgba(255,255,255,0.50)",
			};
}

export function glassSpecular(isDark: boolean): CSSProperties {
	return {
		background: isDark
			? "radial-gradient(ellipse at 30% 0%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 40%, transparent 70%)"
			: "radial-gradient(ellipse at 30% 0%, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.2) 40%, transparent 70%)",
		position: "absolute",
		inset: 0,
		borderRadius: "inherit",
		pointerEvents: "none",
		zIndex: 0,
	};
}
