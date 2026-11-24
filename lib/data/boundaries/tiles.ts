import { withCDN } from "@/lib/helpers/cdn";
import { getFeatureProp } from "@uk-data-atlas/datasets";
import {
	parseBoundaryResources,
	type BoundaryResources,
} from "@uk-data-atlas/areas/boundary-resources";
import { featureIds } from "@uk-data-atlas/geometry/tiles/featureIds";
import type { BoundaryGeojson, PropertyKeys } from "@uk-data-atlas/datasets";
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
import { pmtilesURL } from "@/lib/map/tilesUrl";
import { prefetchPMTiles } from "@/lib/map/pmtilesProtocol";

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

const prefetched = new Set<string>();

/**
 * Reads what drawing a boundary release first waits on, its properties and its
 * archive's header and root directory, so switching to it starts on its tiles.
 * Each release is read once; both reads are cached where the map looks.
 */
export function prefetchBoundaryRelease(type: BoundaryType, year: number) {
	const path = BOUNDARY_CATALOG[type]?.vintages[year];
	if (!path || prefetched.has(path)) return;
	prefetched.add(path);
	const forget = () => prefetched.delete(path);
	fetchBoundaryProperties(propertiesAsset(path)).catch(forget);
	fetchManifest()
		.then((manifest) => {
			const { href } = selectBoundaryTiles(manifest, type, path);
			return prefetchPMTiles(
				pmtilesURL(href, window.location.href).slice(
					"pmtiles://".length,
				),
			);
		})
		.catch(forget);
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
