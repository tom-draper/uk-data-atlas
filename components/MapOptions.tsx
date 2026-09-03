import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { themes } from "@/lib/helpers/colorScale";
import {
	ColorTheme,
	MapOptions as MapOptionsType,
} from "@/lib/types/mapOptions";
import { BASE_MAP_STYLES, type BaseMapStyle } from "@/lib/config/baseMapStyles";
import { useIsDark } from "@/lib/context/ThemeContext";
import { panelTheme, glassStyle } from "@/lib/helpers/panelTheme";
import GlassOverlays from "./GlassOverlays";

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
	const [hideBorders, setHideBorders] = useState(false);
	const [hideBoundaryLayer, setHideBoundaryLayer] = useState(false);
	const [hideOverlay, setHideOverlay] = useState(false);
	const [overlayOpacity, setOverlayOpacity] = useState(0.6);
	const [opacityInput, setOpacityInput] = useState("60");
	const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
	const triggerRef = useRef<HTMLButtonElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);

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

	const handleBordersToggle = () => {
		const newValue = !hideBorders;
		setHideBorders(newValue);
		handleMapOptionsChange("visibility", { hideBorders: newValue });
	};

	const handleBoundaryLayerToggle = () => {
		const newValue = !hideBoundaryLayer;
		setHideBoundaryLayer(newValue);
		handleMapOptionsChange("visibility", { hideBoundaryLayer: newValue });
	};

	const handleOverlayToggle = () => {
		const newValue = !hideOverlay;
		setHideOverlay(newValue);
		handleMapOptionsChange("visibility", { hideOverlay: newValue });
	};

	const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setOpacityInput(e.target.value);
		const parsed = parseInt(e.target.value, 10);
		if (!isNaN(parsed)) {
			const value = Math.min(100, Math.max(0, parsed)) / 100;
			setOverlayOpacity(value);
			handleMapOptionsChange("visibility", { overlayOpacity: value });
		}
	};

	const handleOpacityBlur = () => {
		const pct = Math.min(
			100,
			Math.max(0, parseInt(opacityInput, 10) || 60),
		);
		setOpacityInput(String(pct));
		const value = pct / 100;
		setOverlayOpacity(value);
		handleMapOptionsChange("visibility", { overlayOpacity: value });
	};

	useEffect(() => {
		if (!isOpen) return;
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node;
			if (
				!triggerRef.current?.contains(target) &&
				!dropdownRef.current?.contains(target)
			) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () =>
			document.removeEventListener("mousedown", handleClickOutside);
	}, [isOpen]);

	const isDark = useIsDark();
	const t = panelTheme(isDark);

	return (
		<div
			className={`text-sm rounded-md relative overflow-hidden ${isDark ? "text-gray-100" : "text-gray-800"}`}
			style={glassStyle(isDark)}
		>
			<GlassOverlays isDark={isDark} />
			<div className="p-2.5 relative" style={{ zIndex: 1 }}>
				<h2 className={`font-semibold mb-2 ${t.heading}`}>
					Map Options
				</h2>

				<div className="flex flex-col gap-1.5 pb-2 pt-2 pl-1">
					{(
						[
							{
								label: "Hide data layer",
								checked: hideDataLayer,
								onChange: handleDataToggle,
								disabled: false,
							},
							{
								label: "Hide borders",
								checked: hideBorders,
								onChange: handleBordersToggle,
								disabled: false,
							},
							{
								label: "Hide boundary layer",
								checked: hideBoundaryLayer,
								onChange: handleBoundaryLayerToggle,
								disabled: false,
							},
							{
								label: "Hide overlay",
								checked: hideOverlay,
								onChange: handleOverlayToggle,
								disabled: false,
							},
						] as const
					).map(({ label, checked, onChange, disabled }) => (
						<label
							key={label}
							className="flex items-center gap-2 cursor-pointer group"
						>
							<input
								type="checkbox"
								checked={checked}
								onChange={onChange}
								disabled={disabled}
								className="size-3.5 accent-indigo-500 cursor-pointer"
							/>
							<span
								className={`text-xs transition-colors ${disabled ? "opacity-50" : ""} ${isDark ? "text-gray-400 group-hover:text-gray-200" : "text-gray-600 group-hover:text-gray-800"}`}
							>
								{label}
							</span>
						</label>
					))}
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
								aria-label="Opacity"
								min="0"
								max="100"
								value={opacityInput}
								onChange={handleOpacityChange}
								onBlur={handleOpacityBlur}
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

					<div>
						<button
							ref={triggerRef}
							type="button"
							onClick={() => {
								if (isOpen) {
									setIsOpen(false);
								} else {
									const rect =
										triggerRef.current?.getBoundingClientRect();
									if (rect)
										setDropdownPos({
											top: rect.top,
											left: rect.left,
										});
									setIsOpen(true);
								}
							}}
							className={`border rounded-sm px-2 py-1 text-xs backdrop-blur-md transition-all duration-200 shadow-sm cursor-pointer flex items-center gap-1.5 ${t.border} ${t.text} ${t.hover} ${isDark ? "bg-white/5" : "bg-white/10"}`}
						>
							<div
								className="size-3 rounded-sm"
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

						{isOpen &&
							createPortal(
								<div
									ref={dropdownRef}
									className={`fixed z-[200] min-w-[160px] backdrop-blur-xl border rounded-sm shadow-lg ${t.border} ${isDark ? "bg-[rgba(20,20,30,0.95)]" : "bg-[#f9f9fa]/90"}`}
									style={{
										bottom:
											window.innerHeight -
											dropdownPos.top +
											8,
										left: dropdownPos.left,
									}}
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
												className="size-4 rounded-sm shrink-0"
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
								</div>,
								document.body,
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
