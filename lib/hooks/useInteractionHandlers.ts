import { useCallback, useMemo, useRef, useTransition } from "react";
import type { SelectedArea } from "@lib/types";

interface UseInteractionHandlersParams {
	setSelectedLocation: (location: string) => void;
	setSelectedArea: (area: SelectedArea | null) => void;
}

const isSameArea = (left: SelectedArea, right: SelectedArea) =>
	left.type === right.type && left.code === right.code;

export function useInteractionHandlers({
	setSelectedLocation,
	setSelectedArea,
}: UseInteractionHandlersParams) {
	const lastHoveredCodeRef = useRef<string | null>(null);
	const lockedAreaRef = useRef<SelectedArea | null>(null);
	const [, startTransition] = useTransition();

	const onAreaHover = useCallback(
		(hoverData: SelectedArea | null) => {
			if (lockedAreaRef.current) return;
			if (!hoverData) {
				lastHoveredCodeRef.current = null;
				startTransition(() => setSelectedArea(null));
				return;
			}
			if (hoverData.code === lastHoveredCodeRef.current) return;
			lastHoveredCodeRef.current = hoverData.code;
			startTransition(() => setSelectedArea(hoverData));
		},
		[setSelectedArea, startTransition],
	);

	const onAreaClick = useCallback(
		(area: SelectedArea) => {
			const lockedArea = lockedAreaRef.current;
			lockedAreaRef.current =
				lockedArea && isSameArea(lockedArea, area) ? null : area;
			lastHoveredCodeRef.current = area.code;
			startTransition(() => setSelectedArea(area));
		},
		[setSelectedArea, startTransition],
	);

	const clearAreaLock = useCallback(() => {
		lockedAreaRef.current = null;
		lastHoveredCodeRef.current = null;
		startTransition(() => setSelectedArea(null));
	}, [setSelectedArea, startTransition]);

	const onLocationChange = useCallback(
		(location: string) => {
			clearAreaLock();
			setSelectedLocation(location);
		},
		[clearAreaLock, setSelectedLocation],
	);

	return useMemo(
		() => ({ onAreaHover, onAreaClick, onLocationChange, clearAreaLock }),
		[onAreaHover, onAreaClick, onLocationChange, clearAreaLock],
	);
}
