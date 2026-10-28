import type { AreaGeometryCache } from "./areaGeometry";
import { releaseKey } from "./geographyKeys";
import type { BoundaryReleaseSummary } from "./mapResource/compileMapResource";
import type { MapResourceDescriptor } from "@uk-data-atlas/map-tiles/mapResources";
import { buildFullDetailParquet } from "./mapResource/fullDetail";

/** A release's flat downloads when no tiles can be drawn from it. */
export type FlatDownloads = {
	/** Why the release has downloads but no tiles. */
	reason: string;
	features: MapResourceDescriptor["features"];
};

/**
 * The whole-release download of a release that cannot be tiled, because its
 * areas are not a coverage: some edge lies on more than two of them, so
 * borders cannot be shared and generalised once. A download needs no shared
 * borders, so the release is still offered whole, at full detail only, as
 * published: generalising each area on its own would open gaps between them.
 * Like every full tier it is GeoParquet built from the geometry store when
 * asked for, so nothing is stored for it.
 */
export const compileFlatDownloads = (
	cache: AreaGeometryCache,
	release: BoundaryReleaseSummary,
	names: Map<string, string>,
	reason: string,
): FlatDownloads | undefined => {
	const { geography, id: boundaryRelease } = release;
	const full = buildFullDetailParquet(
		cache,
		{
			geography,
			boundaryRelease,
			attribution: `Contains ${release.source.publisher} data, ${release.source.licence.name}`,
			topology: "none",
		},
		names,
	);
	if (!full) return undefined;
	const id = releaseKey(geography, boundaryRelease);
	return {
		reason,
		features: [
			{
				tier: "full",
				toleranceM: 0,
				rowCount: full.rowCount,
				coordinates: full.coordinates,
				format: "geoparquet-1.1",
				href: `/v1/map-resources/${id}/features?tier=full`,
				bytes: full.body.length,
				contentHash: full.contentHash,
			},
		],
	};
};
