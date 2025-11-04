import { useCallback, useRef } from 'react';
import type { WardData } from '@lib/types';
import { ConstituencyData } from './useGeneralElectionData';

interface UseInteractionHandlersParams {
	setSelectedWard: (ward: WardData | null) => void;
	setSelectedConstituency: (constituency: ConstituencyData | null) => void;
	setSelectedLocation: (location: string | null) => void;
}

/**
 * Provides stable callbacks for ward hover and location change interactions.
 * Optimized to prevent redundant updates when hovering within the same ward or constituency.
 */
export function useInteractionHandlers({
	setSelectedWard,
	setSelectedConstituency,
	setSelectedLocation,
}: UseInteractionHandlersParams) {
	const lastHoveredWardRef = useRef<string | null>(null);
	const lastHoveredConstituencyRef = useRef<string | null>(null);

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
				setSelectedWard(null);
				return;
			}

			setSelectedWard({ ...data, wardCode });
		},
		[setSelectedWard]
	);

	const onConstituencyHover = useCallback(
		(constituencyData: ConstituencyData | null) => {
			const constituencyId = constituencyData?.onsId || null;

			// Skip if hovering over same constituency
			if (constituencyId && constituencyId === lastHoveredConstituencyRef.current) {
				return;
			}

			// Update last hovered constituency
			lastHoveredConstituencyRef.current = constituencyId;

			setSelectedConstituency(constituencyData);
		},
		[setSelectedConstituency]
	);

	const onLocationChange = useCallback(
		(_stats: unknown, location: string) => {
			setSelectedWard(null);
			setSelectedLocation(location);

			// Reset last hovered refs since location changed
			lastHoveredWardRef.current = null;
			lastHoveredConstituencyRef.current = null;
		},
		[setSelectedWard, setSelectedLocation]
	);

	return {
		onWardHover,
		onConstituencyHover,
		onLocationChange,
	};
}