import { decomposeArcs } from "@uk-data-atlas/map-tiles/arcs";
import { compileTiers } from "@uk-data-atlas/map-tiles/topologyTiers";
import { featureIds } from "@uk-data-atlas/map-tiles/featureIds";
import type { GeometryTier } from "@uk-data-atlas/map-tiles/simplifyGeometry";
import type { AreaGeometryCache } from "../../geometry/areaGeometry";
import { buildGeoJsonBody } from "./geoJson";
import { buildGeoParquet } from "./geoParquet";
import type { FullDetailRelease } from "./fullDetail";

export type SimplifiedDownload = {
	tier: Exclude<GeometryTier, "full">;
	format: "geoparquet" | "geojson";
};

export const buildSimplifiedDownload = (
	cache: AreaGeometryCache,
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
