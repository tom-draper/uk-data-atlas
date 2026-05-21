export function panelTheme(isDark: boolean) {
	return {
		panel:    isDark ? "bg-[rgba(20,20,30,0.75)] border-white/10 text-gray-100" : "bg-[rgba(255,255,255,0.5)] border-white/30 text-gray-800",
		section:  isDark ? "bg-white/5"   : "bg-white/20",
		border:   isDark ? "border-white/10" : "border-white/20",
		text:     isDark ? "text-gray-300" : "text-gray-600",
		textMuted:isDark ? "text-gray-500" : "text-gray-400",
		hover:    isDark ? "hover:bg-white/10" : "hover:bg-white/20",
		active:   isDark ? "bg-white/15"  : "bg-white/60",
		input:    isDark ? "bg-white/5 border-white/10 text-gray-300 placeholder:text-gray-600" : "bg-white/10 border-white/30 text-gray-500",
		heading:  isDark ? "text-gray-100" : "text-gray-800",
	} as const;
}
