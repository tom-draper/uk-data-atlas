"use client";
import { useMemo } from "react";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";
import { buildAreaBankFromIndex, type AreaBank, type MatchIndex } from "../data/areaBank";

// Lazily loads the precomputed match-index shard (810 KB gz) and derives the
// AreaBank used for upload-column matching. Gated by `enabled` so the shard is
// only fetched when the upload flow needs it, not on every page load.
export function useMatchIndex(enabled: boolean): { areaBank: AreaBank; loading: boolean } {
	const { datasets, loading } = useJsonDataLoader<MatchIndex>(
		withCDN("/data/precompiled/gazetteer.matchindex.json"),
		enabled,
	);

	const areaBank = useMemo(() => {
		const index = datasets as unknown as MatchIndex;
		if (!index || Object.keys(index).length === 0) return [];
		return buildAreaBankFromIndex(index);
	}, [datasets]);

	return { areaBank, loading };
}
