import { withCDN } from "@/lib/helpers/cdn";
import { getFeatureProp } from "@/lib/types/geometry";
import { boundaryServesVectorTiles } from "@uk-data-atlas/datasets/data/boundaries/capabilities";
import { featureIds } from "@uk-data-atlas/map-tiles/featureIds";
import type { BoundaryGeojson, PropertyKeys } from "@/lib/types/geometry";
import {
	BOUNDARY_CATALOG,
	propertiesAsset,
	type BoundaryType,
} from "./catalog";
import { fetchBoundaryFile, fetchBoundaryProperties } from "./boundaries";
import type { BoundaryGeometryFilter } from "./boundaries";
import { filterFeatures } from "./filter";
import { fetchLsoaToLad, lsoaYearForBoundaryAsset } from "./lsoaLadMappings";

export type BoundaryTiles = {
	href: string;
	minZoom: number;
	maxZoom: number;
	codeKey: PropertyKeys;
	ids: Map<string, number>;
};
type Manifest = {
	minZoom: number;
	maxZoom: number;
	releases: Map<string, string>;
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

export function parseBoundaryTilesManifest(value: unknown): Manifest {
	if (
		!isRecord(value) ||
		!Number.isInteger(value.minZoom) ||
		!Number.isInteger(value.maxZoom) ||
		typeof value.minZoom !== "number" ||
		typeof value.maxZoom !== "number" ||
		value.minZoom < 0 ||
		value.maxZoom < value.minZoom ||
		value.maxZoom > 24 ||
		!isRecord(value.releases) ||
		!isRecord(value.untiled)
	)
		throw new Error("Invalid boundary tiles manifest");
	const releases = new Map<string, string>();
	for (const [key, entry] of Object.entries(value.releases)) {
		if (
			!isRecord(entry) ||
			typeof entry.href !== "string" ||
			entry.href !== `/data/boundaries/${key}/boundaries.pmtiles` ||
			typeof entry.bytes !== "number" ||
			!Number.isSafeInteger(entry.bytes) ||
			entry.bytes <= 0 ||
			key in value.untiled
		)
			throw new Error("Invalid boundary tiles release");
		releases.set(key, entry.href);
	}
	return { minZoom: value.minZoom, maxZoom: value.maxZoom, releases };
}

let manifest: Promise<Manifest | null> | undefined;
function fetchManifest() {
	return (manifest ??= fetch(withCDN("/data/boundaries/tiles.json"))
		.then(async (response) => {
			if (!response.ok)
				throw new Error(`Boundary tiles manifest: ${response.status}`);
			return parseBoundaryTilesManifest(await response.json());
		})
		.catch((error) => {
			console.warn("[boundaries] Using TopoJSON:", error);
			return null;
		}));
}

export function selectBoundaryTiles(
	manifest: Manifest | null,
	type: BoundaryType,
	path: string,
) {
	if (!manifest || !boundaryServesVectorTiles(type)) return null;
	const release = BOUNDARY_CATALOG[type].releases.find(
		(release) => release.asset === path,
	);
	const href = release && manifest.releases.get(`${type}/${release.id}`);
	return href && release
		? {
				href: withCDN(href),
				minZoom: manifest.minZoom,
				maxZoom: manifest.maxZoom,
				codeKey: release.codeKey,
			}
		: null;
}

// Rendering uses sidecars for values and filtering, tiles for coordinates.
export const boundaryTiles = new WeakMap<BoundaryGeojson, BoundaryTiles>();

export async function fetchMapBoundaries(
	path: string,
	filter: BoundaryGeometryFilter,
): Promise<BoundaryGeojson> {
	const tiles =
		process.env.NEXT_PUBLIC_MAP_PROVIDER === "mapbox"
			? null
			: selectBoundaryTiles(await fetchManifest(), filter.type, path);
	if (!tiles) return fetchBoundaryFile(path, filter);
	const properties = await fetchBoundaryProperties(propertiesAsset(path));
	const ids = featureIds([
		...new Set(
			properties.features.flatMap((feature) => {
				const code = getFeatureProp(feature.properties, tiles.codeKey);
				return typeof code === "string" ? [code] : [];
			}),
		),
	]);
	const lsoaToLad =
		filter.type === "lsoa" && filter.location
			? await fetchLsoaToLad(lsoaYearForBoundaryAsset(path) ?? NaN).catch(
					() => undefined,
				)
			: undefined;
	const data = filterFeatures(properties, {
		...filter,
		relations: { ...filter.relations, lsoaToLad },
	});
	boundaryTiles.set(data, { ...tiles, ids });
	return data;
}
