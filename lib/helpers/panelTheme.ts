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
				background:
					"linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 40%, rgba(10,10,20,0.55) 100%)",
				backdropFilter: "blur(28px) saturate(180%) brightness(1.08)",
				WebkitBackdropFilter: "blur(28px) saturate(180%) brightness(1.08)",
				boxShadow:
					"inset 0 1px 0 rgba(255,255,255,0.22), inset 1px 0 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.25), 0 8px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
				border: "1px solid rgba(255,255,255,0.13)",
			}
		: {
				background:
					"linear-gradient(135deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.25) 40%, rgba(200,210,230,0.2) 100%)",
				backdropFilter: "blur(28px) saturate(160%) brightness(1.1)",
				WebkitBackdropFilter: "blur(28px) saturate(160%) brightness(1.1)",
				boxShadow:
					"inset 0 1px 0 rgba(255,255,255,0.8), inset 1px 0 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.06), 0 8px 40px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1)",
				border: "1px solid rgba(255,255,255,0.45)",
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
