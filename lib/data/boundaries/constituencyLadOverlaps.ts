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

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isCrosswalk = (value: unknown): value is Crosswalk =>
	isRecord(value) &&
	Object.values(value).every(
		(targets) =>
			Array.isArray(targets) &&
			targets.every(
				(target) =>
					isRecord(target) &&
					typeof target.code === "string" &&
					typeof target.weight === "number" &&
					Number.isFinite(target.weight),
			),
	);

const parseConstituencyLadOverlaps = (
	value: unknown,
): ConstituencyLadOverlaps => {
	if (
		!isRecord(value) ||
		value.version !== 1 ||
		typeof value.targetLocalAuthorityRelease !== "string" ||
		value.targetLocalAuthorityRelease.length === 0 ||
		!isRecord(value.releases)
	)
		throw new Error("Invalid constituency/LAD overlaps file");
	const releases: Record<string, Crosswalk> = {};
	for (const [release, crosswalk] of Object.entries(value.releases)) {
		if (!isCrosswalk(crosswalk))
			throw new Error("Invalid constituency/LAD overlaps file");
		releases[release] = crosswalk;
	}

	return {
		version: 1,
		targetLocalAuthorityRelease: value.targetLocalAuthorityRelease,
		releases,
	};
};

const URL = withCDN("/data/datasets/constituency-lad-overlaps.json");
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
				return parseConstituencyLadOverlaps(await response.json());
			})
			.then((overlaps) => {
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
