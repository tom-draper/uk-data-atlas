"use client";
import { useMemo } from "react";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";
import { Gazetteer } from "../data/gazetteer/gazetteer";
import type { Crosswalk, GazetteerCore } from "../data/gazetteer/types";

// Loads the eager core immediately; the constituency->LAD crosswalk shard is
// fetched only when `withConversions` is set (design doc 3.1 lazy shards).
export function useGazetteer(withConversions = false) {
	const core = useJsonDataLoader<GazetteerCore>(
		withCDN("/data/precompiled/gazetteer.core.json"),
	);
	const cw = useJsonDataLoader<Crosswalk>(
		withCDN("/data/precompiled/crosswalk.constituency-localAuthority.json"),
		withConversions,
	);

	const gazetteer = useMemo(() => {
		const c = core.datasets as unknown as GazetteerCore;
		if (!c?.byCode) return null;
		const g = new Gazetteer(c);
		const cwData = cw.datasets as unknown as Crosswalk;
		if (cwData && Object.keys(cwData).length)
			g.registerCrosswalk("constituency", "localAuthority", cwData);
		return g;
	}, [core.datasets, cw.datasets]);

	return {
		gazetteer,
		ready: gazetteer !== null,
		loading: core.loading,
		error: core.error,
	};
}
