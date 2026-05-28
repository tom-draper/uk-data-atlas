import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { themes } from "@/lib/helpers/colorScale";
import {
	ColorTheme,
	MapOptions as MapOptionsType,
} from "@/lib/types/mapOptions";
import { BASE_MAP_STYLES, type BaseMapStyle } from "@/lib/config/baseMapStyles";
import { useIsDark } from "@/lib/context/ThemeContext";
import { panelTheme } from "@/lib/helpers/panelTheme";

interface MapOptionsProps {
	onZoomIn: () => void;
	onZoomOut: () => void;
	handleMapOptionsChange: (
		type: keyof MapOptionsType,
		options: Partial<MapOptionsType[typeof type]>,
	) => void;
	onExport: () => void;
}

export default function MapOptions({
	onZoomIn,
	onZoomOut,
	handleMapOptionsChange,
	onExport,
}: MapOptionsProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [selectedTheme, setSelectedTheme] = useState("viridis");
	const [selectedBaseStyle, setSelectedBaseStyle] =
		useState<BaseMapStyle["id"]>("positron");
	const [hideDataLayer, setHideDataLayer] = useState(false);
	const [hideBoundaries, setHideBoundaries] = useState(false);
	const [hideOverlay, setHideOverlay] = useState(false);
	const [overlayOpacity, setOverlayOpacity] = useState(0.6);
	const containerRef = useRef<HTMLDivElement>(null);

	const handleThemeChange = (themeId: ColorTheme) => {
		setSelectedTheme(themeId);
		setIsOpen(false);
		handleMapOptionsChange("theme", { id: themeId });
	};

	const handleBaseStyleChange = (styleId: BaseMapStyle["id"]) => {
		setSelectedBaseStyle(styleId);
		handleMapOptionsChange("baseStyle", { id: styleId });
	};

	const handleDataToggle = () => {
		const newValue = !hideDataLayer;
		setHideDataLayer(newValue);
		handleMapOptionsChange("visibility", { hideDataLayer: newValue });
	};

	const handleBoundariesToggle = () => {
		const newValue = !hideBoundaries;
		setHideBoundaries(newValue);
		// If hiding boundaries, also hide data since data is applied over boundaries
		if (!newValue) {
			setHideDataLayer(false);
			handleMapOptionsChange("visibility", {
				hideBoundaries: newValue,
				hideDataLayer: false,
			});
		} else {
			handleMapOptionsChange("visibility", { hideBoundaries: newValue });
		}
	};

	const handleOverlayToggle = () => {
		const newValue = !hideOverlay;
		setHideOverlay(newValue);
		handleMapOptionsChange("visibility", { hideOverlay: newValue });
	};

	const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const pct = Math.min(
			100,
			Math.max(0, parseInt(e.target.value, 10) || 0),
		);
		const value = pct / 100;
		setOverlayOpacity(value);
		handleMapOptionsChange("visibility", { overlayOpacity: value });
	};

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
			return () => {
				document.removeEventListener("mousedown", handleClickOutside);
			};
		}
	}, [isOpen]);

	const isDark = useIsDark();
	const t = panelTheme(isDark);

	return (
		<div
			className={`text-sm rounded-md backdrop-blur-md shadow-lg border ${t.panel}`}
		>
			<div className="p-2.5 relative">
				<h2 className={`font-semibold mb-2 ${t.heading}`}>
					Map Options
				</h2>

				<div className="flex flex-col gap-1.5 pb-2 pt-2 pl-1">
					<label className="flex items-center gap-2 cursor-pointer group">
						<input
							type="checkbox"
							checked={hideDataLayer}
							onChange={handleDataToggle}
							disabled={hideBoundaries}
							className="w-3.5 h-3.5 accent-indigo-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
						/>
						<span
							className={`text-xs transition-colors ${isDark ? "text-gray-400 group-hover:text-gray-200" : "text-gray-600 group-hover:text-gray-800"} ${hideBoundaries ? "opacity-50" : ""}`}
						>
							Hide data layer
						</span>
					</label>
					<label className="flex items-center gap-2 cursor-pointer group">
						<input
							type="checkbox"
							checked={hideBoundaries}
							onChange={handleBoundariesToggle}
							className="w-3.5 h-3.5 accent-indigo-500 cursor-pointer"
						/>
						<span
							className={`text-xs transition-colors ${isDark ? "text-gray-400 group-hover:text-gray-200" : "text-gray-600 group-hover:text-gray-800"}`}
						>
							Hide boundaries
						</span>
					</label>
					<label className="flex items-center gap-2 cursor-pointer group">
						<input
							type="checkbox"
							checked={hideOverlay}
							onChange={handleOverlayToggle}
							className="w-3.5 h-3.5 accent-indigo-500 cursor-pointer"
						/>
						<span
							className={`text-xs transition-colors ${isDark ? "text-gray-400 group-hover:text-gray-200" : "text-gray-600 group-hover:text-gray-800"}`}
						>
							Hide overlay
						</span>
					</label>
					<div className="flex items-stretch gap-2 pt-0.5">
						<span
							className={`text-xs shrink-0 self-center ${t.text}`}
						>
							Opacity
						</span>
						<div
							className={`flex items-center border rounded-sm overflow-hidden ${t.input}`}
						>
							<input
								type="number"
								min="0"
								max="100"
								value={Math.round(overlayOpacity * 100)}
								onChange={handleOpacityChange}
								className="w-8 text-xs bg-transparent text-right px-1 py-0.5 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
							/>
							<span className={`text-xs pr-1 ${t.textMuted}`}>
								%
							</span>
						</div>
						<div
							className={`flex border rounded-sm overflow-hidden ml-auto ${t.border} ${isDark ? "bg-white/5" : "bg-white/10"}`}
						>
							{BASE_MAP_STYLES.map((style) => (
								<button
									type="button"
									key={style.id}
									onClick={() =>
										handleBaseStyleChange(style.id)
									}
									className={`px-2 text-xs transition-all duration-200 cursor-pointer border-r last:border-r-0 ${t.border} ${
										selectedBaseStyle === style.id
											? `${isDark ? "bg-white/15 text-gray-100" : "bg-white/30 text-gray-700"}`
											: `${t.text} ${t.hover}`
									}`}
								>
									{style.label}
								</button>
							))}
						</div>
					</div>
				</div>

				<div className="flex items-center justify-between gap-2 pt-1">
					<div
						className={`absolute flex flex-col top-2.5 right-2.5 border rounded-sm overflow-hidden backdrop-blur-md shadow-sm ${t.border} ${isDark ? "bg-white/5" : "bg-white/10"}`}
					>
						<button
							type="button"
							onClick={onZoomIn}
							className={`px-2 py-1 text-sm transition-all duration-200 font-semibold leading-none border-b cursor-pointer ${t.border} ${t.text} ${t.hover}`}
						>
							+
						</button>
						<button
							type="button"
							onClick={onZoomOut}
							className={`px-2 py-1 text-sm transition-all duration-200 font-semibold leading-none cursor-pointer ${t.text} ${t.hover}`}
						>
							−
						</button>
					</div>

					<div className="relative" ref={containerRef}>
						<button
							type="button"
							onClick={() => setIsOpen(!isOpen)}
							className={`border rounded-sm px-2 py-1 text-xs backdrop-blur-md transition-all duration-200 shadow-sm cursor-pointer flex items-center gap-1.5 ${t.border} ${t.text} ${t.hover} ${isDark ? "bg-white/5" : "bg-white/10"}`}
						>
							<div
								className="w-3 h-3 rounded-sm"
								style={{
									background: themes.find(
										(theme) => theme.id === selectedTheme,
									)?.gradient,
								}}
							/>
							Heatmap
							<ChevronDown
								size={12}
								className={`transition-transform duration-200 ${isOpen ? "rotate-180" : "rotate-0"}`}
							/>
						</button>

						{isOpen && (
							<div
								className={`absolute bottom-full mb-2 left-0 min-w-[160px] backdrop-blur-xl border rounded-sm shadow-lg z-10 ${t.border} ${isDark ? "bg-[rgba(20,20,30,0.95)]" : "bg-[#f9f9fa]/90"}`}
							>
								{themes.map((theme) => (
									<button
										type="button"
										key={theme.id}
										onClick={() =>
											handleThemeChange(theme.id)
										}
										className={`w-full px-2.5 py-1.5 text-xs text-left transition-colors duration-150 border-b last:border-b-0 flex items-center gap-2 cursor-pointer ${t.border} ${t.hover} ${t.text}`}
									>
										<div
											className="w-4 h-4 rounded-sm shrink-0"
											style={{
												background: theme.gradient,
											}}
										/>
										<span className="font-medium">
											{theme.label}
										</span>
										{selectedTheme === theme.id && (
											<span
												className={`ml-auto ${t.textMuted}`}
											>
												✓
											</span>
										)}
									</button>
								))}
							</div>
						)}
					</div>

					<button
						type="button"
						onClick={onExport}
						className={`cursor-pointer border rounded-sm px-2 py-1 text-xs backdrop-blur-md transition-all duration-200 shadow-sm ${t.border} ${t.text} ${t.hover} ${isDark ? "bg-white/5" : "bg-white/10"}`}
					>
						Export
					</button>
				</div>
			</div>
		</div>
	);
}
