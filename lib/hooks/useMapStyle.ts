import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { BASE_MAP_STYLES, type BaseMapStyle } from "@/lib/config/baseMapStyles";

/** Applies base-style changes and reports when the active style is ready. */
export function useMapStyle(
	mapRef: RefObject<MapLibreMap | null>,
	mapReady: boolean,
	styleId: BaseMapStyle["id"],
): boolean {
	const [loadedStyleId, setLoadedStyleId] = useState<
		BaseMapStyle["id"] | null
	>(null);
	const initialStyleApplied = useRef(false);

	useEffect(() => {
		const map = mapRef.current;
		if (!map || !mapReady) return;

		const handleStyleReady = () => {
			if (map.isStyleLoaded()) setLoadedStyleId(styleId);
		};
		map.on("idle", handleStyleReady);

		if (!initialStyleApplied.current) {
			initialStyleApplied.current = true;
			handleStyleReady();
		} else {
			const styleUrl = BASE_MAP_STYLES.find(
				(style) => style.id === styleId,
			)?.url;
			if (styleUrl) map.setStyle(styleUrl);
		}

		return () => {
			map.off("idle", handleStyleReady);
		};
	}, [mapReady, mapRef, styleId]);

	return loadedStyleId === styleId;
}
