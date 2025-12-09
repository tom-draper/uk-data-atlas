import { useRef } from 'react';
import type { ConstituencyData, WardData, LocalAuthorityData } from '@lib/types';
import type { LocationHoverData } from '@lib/utils/mapManager/mapManager';

interface UseInteractionHandlersParams {
	setSelectedWard: (ward: WardData | null) => void;
	setSelectedConstituency: (constituency: ConstituencyData | null) => void;
	setSelectedLocalAuthority?: (localAuthority: LocalAuthorityData | null) => void;
	setSelectedLocation: (location: string) => void;
}

/**
 * Provides stable, high-performance callbacks for location interactions.
 * Callbacks are created once and reused to minimize overhead.
 */
export function useInteractionHandlers({
	setSelectedWard,
	setSelectedConstituency,
	setSelectedLocalAuthority,
	setSelectedLocation,
}: UseInteractionHandlersParams) {
	const lastHoveredCodeRef = useRef<string | null>(null);

	// Create callbacks only once - these never change identity
	const callbacksRef = useRef({
		onLocationHover: (location: LocationHoverData | null) => {
			if (!location) {
				lastHoveredCodeRef.current = null;
				setSelectedWard(null);
				setSelectedConstituency(null);
				setSelectedLocalAuthority?.(null);
				return;
			}

			// Skip if same location
			if (location.code === lastHoveredCodeRef.current) return;

			lastHoveredCodeRef.current = location.code;

			switch (location.type) {
				case 'ward':
					setSelectedConstituency(null);
					setSelectedLocalAuthority?.(null);
					setSelectedWard(location.data ? { ...location.data, wardCode: location.code } : null);
					break;

				case 'constituency':
					setSelectedWard(null);
					setSelectedLocalAuthority?.(null);
					setSelectedConstituency(location.data);
					break;

				case 'localAuthority':
					setSelectedWard(null);
					setSelectedConstituency(null);
					setSelectedLocalAuthority?.(location.data);
					break;
			}
		},
		onLocationChange: (location: string) => {
			setSelectedWard(null);
			setSelectedConstituency(null);
			setSelectedLocalAuthority?.(null);
			setSelectedLocation(location);
			lastHoveredCodeRef.current = null;
		}
	});

	return callbacksRef.current;
}