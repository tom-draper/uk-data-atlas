import { withCDN } from "@/lib/helpers/cdn";
import { getFeatureProp } from "@/lib/types/geometry";
import {
	parseBoundaryResources,
	type BoundaryResources,
} from "@uk-data-atlas/atlas-runtime/areas";
import { featureIds } from "@uk-data-atlas/map-tiles/featureIds";
import type { BoundaryGeojson, PropertyKeys } from "@/lib/types/geometry";
import {
	BOUNDARY_CATALOG,
	boundaryArchiveAsset,
	propertiesAsset,
	type BoundaryType,
} from "./catalog";
import { fetchBoundaryProperties } from "./boundaries";
import type { BoundaryFeatureFilter } from "./filter";
import { filterFeatures } from "./filter";
import { fetchLsoaToLad, lsoaYearForBoundaryAsset } from "./lsoaLadMappings";

export type BoundaryTiles = {
	href: string;
	minZoom: number;
	maxZoom: number;
	codeKey: PropertyKeys;
	ids: Map<string, number>;
};
type Manifest = BoundaryResources;
export const parseBoundaryTilesManifest = parseBoundaryResources;
let manifest: Promise<Manifest> | undefined;
function fetchManifest(): Promise<Manifest> {
	return (manifest ??= fetch(withCDN("/data/boundaries/tiles.json"))
		.then(async (response) => {
			if (!response.ok)
				throw new Error(`Boundary map manifest: ${response.status}`);
			return parseBoundaryResources(await response.json());
		})
		.catch((error: unknown) => {
			manifest = undefined;
			throw error;
		}));
}

function selectResource(manifest: Manifest, type: BoundaryType, path: string) {
	const release = BOUNDARY_CATALOG[type].releases.find(
		(release) => release.asset === path,
	);
	const resource = release && manifest.releases[`${type}/${release.id}`];
	if (!release || !resource)
		throw new Error(
			`Missing boundary map resource: ${type}/${path}. Run pnpm data:build.`,
		);
	return { release, resource };
}

export function selectBoundaryTiles(
	manifest: Manifest,
	type: BoundaryType,
	path: string,
) {
	const { release, resource } = selectResource(manifest, type, path);
	return {
		href: boundaryArchiveAsset(resource.href),
		minZoom: manifest.minZoom,
		maxZoom: manifest.maxZoom,
		codeKey: release.codeKey,
	};
}

// Rendering uses sidecars for values and filtering, tiles for coordinates.
export const boundaryTiles = new WeakMap<BoundaryGeojson, BoundaryTiles>();

export async function fetchMapBoundaries(
	path: string,
	filter: BoundaryFeatureFilter,
): Promise<BoundaryGeojson> {
	const manifest = await fetchManifest();
	const tiles = selectBoundaryTiles(manifest, filter.type, path);
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
