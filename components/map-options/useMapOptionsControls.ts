import { useState } from "react";
import type { ColorTheme, MapOptions } from "@/lib/types/mapOptions";
import type { BaseMapStyle } from "@/lib/config/baseMapStyles";
import { normalizedOpacityInput, opacityFromInput } from "./opacity";
import type { MapOptionsChangeHandler, VisibilityToggle } from "./types";

export function useMapOptionsControls(
	mapOptions: MapOptions,
	onMapOptionsChange: MapOptionsChangeHandler,
) {
	const [opacityInput, setOpacityInput] = useState(
		String(mapOptions.visibility.overlayOpacity * 100),
	);

	const updateVisibility = (options: Partial<MapOptions["visibility"]>) => {
		onMapOptionsChange("visibility", options);
	};

	return {
		selectedTheme: mapOptions.theme.id,
		selectedBaseStyle: mapOptions.baseStyle.id,
		visibility: mapOptions.visibility,
		opacityInput,
		selectTheme: (themeId: ColorTheme) => {
			onMapOptionsChange("theme", { id: themeId });
		},
		selectBaseStyle: (styleId: BaseMapStyle["id"]) => {
			onMapOptionsChange("baseStyle", { id: styleId });
		},
		toggleVisibility: (option: VisibilityToggle) =>
			updateVisibility({ [option]: !mapOptions.visibility[option] }),
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
