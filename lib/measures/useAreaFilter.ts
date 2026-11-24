"use client";

import { useMemo } from "react";
import { restrictToAreas } from "./cache";
import type { MeasureValuesPayload } from "./types";

/** Keep the filter stable when a caller recreates the same list of codes. */
export function useAreaFilter(areas: readonly string[] | undefined) {
	const key = useMemo(
		() => (areas === undefined ? undefined : JSON.stringify(areas)),
		[areas],
	);
	return useMemo(() => {
		if (key === undefined) return undefined;
		const codes = JSON.parse(key) as string[];
		return (payload: MeasureValuesPayload) =>
			restrictToAreas(payload, codes);
	}, [key]);
}
