import { useRef } from "react";
import type { SelectedArea } from "@lib/types";

interface UseInteractionHandlersParams {
	setSelectedLocation: (location: string) => void;
	setSelectedArea: (area: SelectedArea | null) => void;
}

/**
 * Provides stable, high-performance callbacks for location interactions.
 * Callbacks are created once and reused to minimize overhead.
 */
export function useInteractionHandlers({
	setSelectedLocation,
	setSelectedArea,
}: UseInteractionHandlersParams) {
	const lastHoveredCodeRef = useRef<string | null>(null);

	// Create callbacks only once - these never change identity
	const callbacksRef = useRef({
		onAreaHover: (hoverData: SelectedArea | null) => {
			if (!hoverData) {
				lastHoveredCodeRef.current = null;
				setSelectedArea(null);
				return;
			}

			// Skip if same location
			if (hoverData.code === lastHoveredCodeRef.current) return;

			lastHoveredCodeRef.current = hoverData.code;

			setSelectedArea(hoverData);
		},
		onLocationChange: (location: string) => {
			setSelectedArea(null);
			setSelectedLocation(location);
			lastHoveredCodeRef.current = null;
		},
	});

	return callbacksRef.current;
}
