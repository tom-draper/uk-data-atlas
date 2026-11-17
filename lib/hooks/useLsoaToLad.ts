"use client";

import { useEffect, useState } from "react";
import { fetchLsoaToLad } from "@/lib/data/boundaries/lsoaLadMappings";

/**
 * The local authority each LSOA of a boundary year belongs to, once loaded.
 * Null while loading, when `year` is undefined, or if the lookup fails.
 */
export function useLsoaToLad(
	year: number | undefined,
): Record<string, string> | null {
	const [mapping, setMapping] = useState<{
		year: number;
		lsoaToLad: Record<string, string>;
	} | null>(null);

	useEffect(() => {
		if (year === undefined) return;
		let cancelled = false;
		fetchLsoaToLad(year)
			.then((lsoaToLad) => {
				if (!cancelled) setMapping({ year, lsoaToLad });
			})
			.catch((error: unknown) => {
				console.warn("[lsoa] LSOA/LAD mapping unavailable:", error);
			});
		return () => {
			cancelled = true;
		};
	}, [year]);

	return mapping && mapping.year === year ? mapping.lsoaToLad : null;
}
