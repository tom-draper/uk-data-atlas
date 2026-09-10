import type { BaseMapStyle } from "@/lib/config/baseMapStyles";
import { BASE_MAP_STYLES } from "@/lib/config/baseMapStyles";
import type { panelTheme } from "@/lib/helpers/panelTheme";
import type { MapOptions } from "@/lib/types/mapOptions";
import type { VisibilityToggle } from "./types";

interface AppearanceControlsProps {
	isDark: boolean;
	theme: ReturnType<typeof panelTheme>;
	selectedBaseStyle: BaseMapStyle["id"];
	visibility: MapOptions["visibility"];
	opacityInput: string;
	onBaseStyleChange: (styleId: BaseMapStyle["id"]) => void;
	onVisibilityToggle: (option: VisibilityToggle) => void;
	onOpacityChange: (input: string) => void;
	onOpacityBlur: () => void;
	onZoomIn: () => void;
	onZoomOut: () => void;
}

const visibilityLabels: Array<{ label: string; option: VisibilityToggle }> = [
	{ label: "Hide data layer", option: "hideDataLayer" },
	{ label: "Hide borders", option: "hideBorders" },
	{ label: "Hide boundary layer", option: "hideBoundaryLayer" },
	{ label: "Hide overlay", option: "hideOverlay" },
];

export function AppearanceControls({
	isDark,
	theme,
	selectedBaseStyle,
	visibility,
	opacityInput,
	onBaseStyleChange,
	onVisibilityToggle,
	onOpacityChange,
	onOpacityBlur,
	onZoomIn,
	onZoomOut,
}: AppearanceControlsProps) {
	return (
		<>
			<div className="flex flex-col gap-1.5 pb-2 pt-2 pl-1">
				{visibilityLabels.map(({ label, option }) => (
					<label
						key={option}
						className="flex items-center gap-2 cursor-pointer group"
					>
						<input
							type="checkbox"
							checked={visibility[option]}
							onChange={() => onVisibilityToggle(option)}
							className="size-3.5 accent-indigo-500 cursor-pointer"
						/>
						<span
							className={`text-xs transition-colors ${isDark ? "text-gray-400 group-hover:text-gray-200" : "text-gray-600 group-hover:text-gray-800"}`}
						>
							{label}
						</span>
					</label>
				))}
				<div className="flex items-stretch gap-2 pt-0.5">
					<span
						className={`text-xs shrink-0 self-center ${theme.text}`}
					>
						Opacity
					</span>
					<div
						className={`flex items-center border rounded-sm overflow-hidden ${theme.input}`}
					>
						<input
							type="number"
							aria-label="Opacity"
							min="0"
							max="100"
							value={opacityInput}
							onChange={(event) =>
								onOpacityChange(event.target.value)
							}
							onBlur={onOpacityBlur}
							className="w-8 text-xs bg-transparent text-right px-1 py-0.5 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
						/>
						<span className={`text-xs pr-1 ${theme.textMuted}`}>
							%
						</span>
					</div>
					<div
						className={`flex border rounded-sm overflow-hidden ml-auto ${theme.border} ${isDark ? "bg-white/5" : "bg-white/10"}`}
					>
						{BASE_MAP_STYLES.map((style) => (
							<button
								type="button"
								key={style.id}
								onClick={() => onBaseStyleChange(style.id)}
								className={`px-2 text-xs transition-all duration-200 cursor-pointer border-r last:border-r-0 ${theme.border} ${
									selectedBaseStyle === style.id
										? `${isDark ? "bg-white/15 text-gray-100" : "bg-white/30 text-gray-700"}`
										: `${theme.text} ${theme.hover}`
								}`}
							>
								{style.label}
							</button>
						))}
					</div>
				</div>
			</div>

			<div
				className={`absolute flex flex-col top-2.5 right-2.5 border rounded-sm overflow-hidden backdrop-blur-md shadow-sm ${theme.border} ${isDark ? "bg-white/5" : "bg-white/10"}`}
			>
				<button
					type="button"
					onClick={onZoomIn}
					className={`px-2 py-1 text-sm transition-all duration-200 font-semibold leading-none border-b cursor-pointer ${theme.border} ${theme.text} ${theme.hover}`}
				>
					+
				</button>
				<button
					type="button"
					onClick={onZoomOut}
					className={`px-2 py-1 text-sm transition-all duration-200 font-semibold leading-none cursor-pointer ${theme.text} ${theme.hover}`}
				>
					−
				</button>
			</div>
		</>
	);
}
