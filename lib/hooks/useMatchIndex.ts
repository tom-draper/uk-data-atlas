"use client";
import { useMemo } from "react";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";
import {
	buildAreaBankFromIndex,
	parseMatchIndexLevel,
	type AreaBank,
} from "../data/areaBank";

// Lazily loads the precomputed match-index shard (1.4 MB gz, every geography
// the catalogue serves) and derives the AreaBank used for upload-column
// matching. Gated by `enabled` so the shard is only fetched when the upload
// flow needs it, not on every page load.
export function useMatchIndex(enabled: boolean): {
	areaBank: AreaBank;
	loading: boolean;
} {
	const { datasets: index, loading } = useJsonDataLoader(
		withCDN("/data/datasets/gazetteer.matchindex.json"),
		parseMatchIndexLevel,
		enabled,
	);

	const areaBank = useMemo(() => {
		if (!index || Object.keys(index).length === 0) return [];
		return buildAreaBankFromIndex(index);
	}, [index]);

	return { areaBank, loading };
}
