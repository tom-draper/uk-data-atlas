import { decomposeArcs } from "../../arcs.ts";
import { compileTiers } from "../../topologyTiers.ts";
import { featureIds } from "../../featureIds.ts";
import type { GeometryTier } from "../../simplifyGeometry.ts";
import type { MapGeometryCache } from "./geometryCache.ts";
import { buildGeoJsonBody } from "./geoJson.ts";
import { buildGeoParquet } from "./geoParquet.ts";
import type { FullDetailRelease } from "./fullDetail.ts";

export type SimplifiedDownload = {
	tier: Exclude<GeometryTier, "full">;
	format: "geoparquet" | "geojson";
};

export const buildSimplifiedDownload = (
	cache: MapGeometryCache,
	release: FullDetailRelease,
	names: Map<string, string>,
	download: SimplifiedDownload,
): Buffer | undefined => {
	const { geography, boundaryRelease } = release;
	const areas = new Map(
		cache
			.codes(geography, boundaryRelease)
			.filter((code) => names.size === 0 || names.has(code))
			.flatMap((code) => {
				const geometry = cache.get(geography, boundaryRelease, code);
				return geometry ? [[code, geometry] as const] : [];
			}),
	);
	if (!areas.size || release.topology !== "shared-arc") return undefined;
	const topology = decomposeArcs(areas);
	if (topology.overlappingEdges) return undefined;
	const compiled = compileTiers(topology, [download.tier]).get(
		download.tier,
	)!;
	const numbered = featureIds([...areas.keys()]);
	const rows = [...compiled.areas].map(([code, geometry]) => ({
		id: numbered.get(code)!,
		code,
		name: names.get(code) ?? code,
		geometry,
	}));
	const mapResource = `${geography}/${boundaryRelease}`;
	if (download.format === "geojson")
		return buildGeoJsonBody(rows, {
			mapResource,
			tier: download.tier,
			attribution: release.attribution,
		});
	return buildGeoParquet(rows, {
		mapResource,
		tier: download.tier,
		toleranceM: compiled.toleranceM,
		topology: "shared-arc",
		attribution: release.attribution,
		geometrySourceInputHash:
			cache.provenance(geography, boundaryRelease).inputHash ?? null,
	});
};
