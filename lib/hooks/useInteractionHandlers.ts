import { useRef } from 'react';
import type { SelectedArea } from '@lib/types';
import type { LocationHoverData } from '@lib/utils/mapManager/mapManager';

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
		onLocationHover: (hoverData: LocationHoverData | null) => {
			if (!hoverData) {
				lastHoveredCodeRef.current = null;
				setSelectedArea(null);
				return;
			}

			// Skip if same location
			if (hoverData.code === lastHoveredCodeRef.current) return;

			lastHoveredCodeRef.current = hoverData.code;

			setSelectedArea({type: hoverData.type, data: hoverData.data})
		},
		onLocationChange: (location: string) => {
			setSelectedArea(null);
			setSelectedLocation(location);
			lastHoveredCodeRef.current = null;
		}
	});

	return callbacksRef.current;
}