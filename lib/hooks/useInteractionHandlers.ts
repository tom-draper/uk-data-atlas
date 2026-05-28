import { useRef, useTransition } from "react";
import type { SelectedArea } from "@lib/types";

interface UseInteractionHandlersParams {
	setSelectedLocation: (location: string) => void;
	setSelectedArea: (area: SelectedArea | null) => void;
}

export function useInteractionHandlers({
	setSelectedLocation,
	setSelectedArea,
}: UseInteractionHandlersParams) {
	const lastHoveredCodeRef = useRef<string | null>(null);
	const [, startTransition] = useTransition();

	return {
		onAreaHover: (hoverData: SelectedArea | null) => {
			if (!hoverData) {
				lastHoveredCodeRef.current = null;
				startTransition(() => setSelectedArea(null));
				return;
			}
			if (hoverData.code === lastHoveredCodeRef.current) return;
			lastHoveredCodeRef.current = hoverData.code;
			startTransition(() => setSelectedArea(hoverData));
		},
		onLocationChange: (location: string) => {
			setSelectedArea(null);
			setSelectedLocation(location);
			lastHoveredCodeRef.current = null;
		},
	};
}
