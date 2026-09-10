import { useIsDark } from "@/lib/context/ThemeContext";
import { glassStyle, panelTheme } from "@/lib/helpers/panelTheme";
import GlassOverlays from "./GlassOverlays";
import { AppearanceControls } from "./map-options/AppearanceControls";
import { ThemeSelector } from "./map-options/ThemeSelector";
import type { MapOptionsChangeHandler } from "./map-options/types";
import { useMapOptionsControls } from "./map-options/useMapOptionsControls";

interface MapOptionsProps {
	onZoomIn: () => void;
	onZoomOut: () => void;
	handleMapOptionsChange: MapOptionsChangeHandler;
	onExport: () => void;
}

export default function MapOptions({
	onZoomIn,
	onZoomOut,
	handleMapOptionsChange,
	onExport,
}: MapOptionsProps) {
	const controls = useMapOptionsControls(handleMapOptionsChange);
	const isDark = useIsDark();
	const theme = panelTheme(isDark);

	return (
		<div
			className={`text-sm rounded-md relative overflow-hidden ${isDark ? "text-gray-100" : "text-gray-800"}`}
			style={glassStyle(isDark)}
		>
			<GlassOverlays isDark={isDark} />
			<div className="p-2.5 relative" style={{ zIndex: 1 }}>
				<h2 className={`font-semibold mb-2 ${theme.heading}`}>
					Map Options
				</h2>
				<AppearanceControls
					isDark={isDark}
					theme={theme}
					selectedBaseStyle={controls.selectedBaseStyle}
					visibility={controls.visibility}
					opacityInput={controls.opacityInput}
					onBaseStyleChange={controls.selectBaseStyle}
					onVisibilityToggle={controls.toggleVisibility}
					onOpacityChange={controls.changeOpacity}
					onOpacityBlur={controls.normalizeOpacity}
					onZoomIn={onZoomIn}
					onZoomOut={onZoomOut}
				/>

				<div className="flex items-center justify-between gap-2 pt-1">
					<ThemeSelector
						isDark={isDark}
						theme={theme}
						selectedTheme={controls.selectedTheme}
						onThemeChange={controls.selectTheme}
					/>
					<button
						type="button"
						onClick={onExport}
						className={`cursor-pointer border rounded-sm px-2 py-1 text-xs backdrop-blur-md transition-all duration-200 shadow-sm ${theme.border} ${theme.text} ${theme.hover} ${isDark ? "bg-white/5" : "bg-white/10"}`}
					>
						Export
					</button>
				</div>
			</div>
		</div>
	);
}
