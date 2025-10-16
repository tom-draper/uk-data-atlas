import { useCallback, useRef, useEffect } from 'react';
import type { WardData } from '@/lib/types';

interface UseWardInteractionHandlersParams {
	setSelectedWard: (ward: WardData | null) => void;
	selectedLocation: string | null;
	setSelectedLocation: (location: string | null) => void;
}

/**
 * Provides stable callbacks for ward hover and location change interactions.
 * Optimized to prevent redundant updates when hovering within the same ward.
 */
export function useWardInteractionHandlers({
	setSelectedWard,
	selectedLocation,
	setSelectedLocation,
}: UseWardInteractionHandlersParams) {
	const lastHoveredWardRef = useRef<string | null>(null);

	const onWardHover = useCallback(
		(params: { data: WardData | null; wardCode: string }) => {
			const { data, wardCode } = params;

			// Skip if hovering over same ward
			if (wardCode && wardCode === lastHoveredWardRef.current) {
				return;
			}

			// Update last hovered ward
			lastHoveredWardRef.current = wardCode || null;

			if (!data) {
				// Reset to previous chart title or location name
				setSelectedWard(null);
				return;
			}

			setSelectedWard({ ...data, wardCode });
		},
		[setSelectedWard, selectedLocation]
	);

	const onLocationChange = useCallback(
		(_stats: any, location: { name: string }) => {
			setSelectedWard(null);
			setSelectedLocation(location.name);

			// Reset last hovered ward since location changed
			lastHoveredWardRef.current = null;
		},
		[setSelectedWard, setSelectedLocation]
	);

	return {
		onWardHover,
		onLocationChange,
	};
}
