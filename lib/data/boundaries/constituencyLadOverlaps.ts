import { BOUNDARY_CATALOG } from "./catalog";
import { withCDN } from "@/lib/helpers/cdn";
import type { Crosswalk } from "../gazetteer/types";

/**
 * Constituency-to-local-authority overlaps derived offline for every served
 * constituency release. A constituency can straddle several authorities, so
 * this is deliberately an overlap list rather than a false single parent.
 */
export type ConstituencyLadOverlaps = {
	version: 1;
	targetLocalAuthorityRelease: string;
	releases: Record<string, Crosswalk>;
};

const URL = withCDN("/data/precompiled/constituency-lad-overlaps.json");
let cached: ConstituencyLadOverlaps | null = null;
let pending: Promise<ConstituencyLadOverlaps> | null = null;

export const constituencyReleaseIdForYear = (year: number) => {
	const asset = BOUNDARY_CATALOG.constituency.vintages[year];
	return BOUNDARY_CATALOG.constituency.releases.find(
		(release) => release.asset === asset,
	)?.id;
};

export const fetchConstituencyLadOverlaps =
	(): Promise<ConstituencyLadOverlaps> => {
		if (cached) return Promise.resolve(cached);
		if (pending) return pending;

		pending = fetch(URL)
			.then(async (response) => {
				if (!response.ok) {
					throw new Error(
						`Failed to fetch constituency/LAD overlaps: ${response.status} ${response.statusText}`,
					);
				}
				return response.json() as Promise<ConstituencyLadOverlaps>;
			})
			.then((overlaps) => {
				if (
					overlaps.version !== 1 ||
					!overlaps.targetLocalAuthorityRelease ||
					!overlaps.releases
				) {
					throw new Error("Invalid constituency/LAD overlaps file");
				}
				cached = overlaps;
				pending = null;
				return overlaps;
			})
			.catch((error) => {
				pending = null;
				throw error;
			});

		return pending;
	};
