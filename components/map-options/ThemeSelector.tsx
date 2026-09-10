import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { themes } from "@/lib/helpers/colorScale";
import type { panelTheme } from "@/lib/helpers/panelTheme";
import type { ColorTheme } from "@/lib/types/mapOptions";

interface ThemeSelectorProps {
	isDark: boolean;
	theme: ReturnType<typeof panelTheme>;
	selectedTheme: ColorTheme;
	onThemeChange: (themeId: ColorTheme) => void;
}

export function ThemeSelector({
	isDark,
	theme,
	selectedTheme,
	onThemeChange,
}: ThemeSelectorProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
	const triggerRef = useRef<HTMLButtonElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isOpen) return;
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node;
			if (
				!triggerRef.current?.contains(target) &&
				!dropdownRef.current?.contains(target)
			)
				setIsOpen(false);
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () =>
			document.removeEventListener("mousedown", handleClickOutside);
	}, [isOpen]);

	const selectTheme = (themeId: ColorTheme) => {
		onThemeChange(themeId);
		setIsOpen(false);
	};

	const toggleMenu = () => {
		if (isOpen) {
			setIsOpen(false);
			return;
		}
		const rect = triggerRef.current?.getBoundingClientRect();
		if (rect) setDropdownPos({ top: rect.top, left: rect.left });
		setIsOpen(true);
	};

	return (
		<div>
			<button
				ref={triggerRef}
				type="button"
				onClick={toggleMenu}
				className={`border rounded-sm px-2 py-1 text-xs backdrop-blur-md transition-all duration-200 shadow-sm cursor-pointer flex items-center gap-1.5 ${theme.border} ${theme.text} ${theme.hover} ${isDark ? "bg-white/5" : "bg-white/10"}`}
			>
				<div
					className="size-3 rounded-sm"
					style={{
						background: themes.find(
							(item) => item.id === selectedTheme,
						)?.gradient,
					}}
				/>
				Heatmap
				<ChevronDown
					size={12}
					className={`transition-transform duration-200 ${isOpen ? "rotate-180" : "rotate-0"}`}
				/>
			</button>

			{isOpen &&
				createPortal(
					<div
						ref={dropdownRef}
						className={`fixed z-[200] min-w-[160px] backdrop-blur-xl border rounded-sm shadow-lg ${theme.border} ${isDark ? "bg-[rgba(20,20,30,0.95)]" : "bg-[#f9f9fa]/90"}`}
						style={{
							bottom: window.innerHeight - dropdownPos.top + 8,
							left: dropdownPos.left,
						}}
					>
						{themes.map((item) => (
							<button
								type="button"
								key={item.id}
								onClick={() => selectTheme(item.id)}
								className={`w-full px-2.5 py-1.5 text-xs text-left transition-colors duration-150 border-b last:border-b-0 flex items-center gap-2 cursor-pointer ${theme.border} ${theme.hover} ${theme.text}`}
							>
								<div
									className="size-4 rounded-sm shrink-0"
									style={{ background: item.gradient }}
								/>
								<span className="font-medium">
									{item.label}
								</span>
								{selectedTheme === item.id && (
									<span
										className={`ml-auto ${theme.textMuted}`}
									>
										✓
									</span>
								)}
							</button>
						))}
					</div>,
					document.body,
				)}
		</div>
	);
}
