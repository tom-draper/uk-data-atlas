import { useState } from "react";
import type { ColorTheme, MapOptions } from "@/lib/types/mapOptions";
import type { BaseMapStyle } from "@/lib/config/baseMapStyles";
import { normalizedOpacityInput, opacityFromInput } from "./opacity";
import type { MapOptionsChangeHandler, VisibilityToggle } from "./types";

const initialVisibility: MapOptions["visibility"] = {
	hideDataLayer: false,
	hideBorders: false,
	hideBoundaryLayer: false,
	hideOverlay: false,
	overlayOpacity: 0.6,
};

export function useMapOptionsControls(
	onMapOptionsChange: MapOptionsChangeHandler,
) {
	const [selectedTheme, setSelectedTheme] = useState<ColorTheme>("viridis");
	const [selectedBaseStyle, setSelectedBaseStyle] =
		useState<BaseMapStyle["id"]>("positron");
	const [visibility, setVisibility] = useState(initialVisibility);
	const [opacityInput, setOpacityInput] = useState("60");

	const updateVisibility = (options: Partial<MapOptions["visibility"]>) => {
		setVisibility((previous) => ({ ...previous, ...options }));
		onMapOptionsChange("visibility", options);
	};

	return {
		selectedTheme,
		selectedBaseStyle,
		visibility,
		opacityInput,
		selectTheme: (themeId: ColorTheme) => {
			setSelectedTheme(themeId);
			onMapOptionsChange("theme", { id: themeId });
		},
		selectBaseStyle: (styleId: BaseMapStyle["id"]) => {
			setSelectedBaseStyle(styleId);
			onMapOptionsChange("baseStyle", { id: styleId });
		},
		toggleVisibility: (option: VisibilityToggle) =>
			updateVisibility({ [option]: !visibility[option] }),
		changeOpacity: (input: string) => {
			setOpacityInput(input);
			const opacity = opacityFromInput(input);
			if (opacity !== null) updateVisibility({ overlayOpacity: opacity });
		},
		normalizeOpacity: () => {
			const normalized = normalizedOpacityInput(opacityInput);
			setOpacityInput(normalized);
			updateVisibility({ overlayOpacity: Number(normalized) / 100 });
		},
	};
}
