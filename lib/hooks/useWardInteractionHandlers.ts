import { useCallback, useRef, useEffect } from 'react';
import type { WardData } from '@/lib/types';

interface UseWardInteractionHandlersParams {
	setChartTitle: (title: string) => void;
	setSelectedWard: (ward: WardData | null) => void;
	selectedLocation: string | null;
	setSelectedLocation: (location: string | null) => void;
}

/**
 * Provides stable callbacks for ward hover and location change interactions.
 * Optimized to prevent redundant updates when hovering within the same ward.
 */
export function useWardInteractionHandlers({
	setChartTitle,
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
				console.log('NO DATA SET CHART TITLE', selectedLocation);
				setChartTitle(selectedLocation || '');
				setSelectedWard(null);
				return;
			}

			console.log('DATA SET CHART TITLE', selectedLocation);
			setChartTitle(data.wardName.toString() || '');
			setSelectedWard({ ...data, wardCode });
		},
		[setChartTitle, setSelectedWard, selectedLocation]
	);

	const onLocationChange = useCallback(
		(_stats: any, location: { name: string }) => {
			console.log('LOCATION CHANGE SET CHART TITLE', location.name);
			setChartTitle(location.name);
			setSelectedWard(null);
			setSelectedLocation(location.name);

			// Reset last hovered ward since location changed
			lastHoveredWardRef.current = null;
		},
		[setChartTitle, setSelectedWard, setSelectedLocation]
	);

	return {
		onWardHover,
		onLocationChange,
	};
}
