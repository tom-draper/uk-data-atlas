import { BoundaryGeojson } from "@lib/types";
import type { BoundaryYear } from "./catalog";

export { BOUNDARY_CATALOG } from "./catalog";
export type { BoundaryType, BoundaryYear } from "./catalog";
export { getProp } from "@uk-data-atlas/datasets/data/boundaries/properties";
export { filterFeatures } from "./filter";

export type WardYear = BoundaryYear<"ward">;
export type ConstituencyYear = BoundaryYear<"constituency">;
export type LocalAuthorityYear = BoundaryYear<"localAuthority">;

/** Properties sidecars, held for every vintage: they are small and all needed. */
const PROPERTIES_CACHE = new Map<string, BoundaryGeojson>();
const PROPERTIES_PENDING = new Map<string, Promise<BoundaryGeojson>>();

type PropertiesFile = { features: Record<string, unknown>[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isPropertiesFile = (value: unknown): value is PropertiesFile =>
	isRecord(value) &&
	Array.isArray(value.features) &&
	value.features.every(isRecord);

/**
 * A sidecar read as a boundary collection whose features carry no geometry, so
 * that filtering and aggregation — which only ever read properties — take it
 * unchanged wherever they would take a decoded file.
 */
const decodeProperties = (json: unknown): BoundaryGeojson => {
	if (!isPropertiesFile(json)) {
		throw new Error("Properties file contains no features");
	}
	return {
		type: "FeatureCollection",
		crs: {
			type: "name",
			properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" },
		},
		features: json.features.map((properties, index) => ({
			type: "Feature" as const,
			id: index + 1,
			geometry: null,
			properties,
		})),
	} as unknown as BoundaryGeojson;
};

/** The properties of every feature in a release, without its coordinates. */
export function fetchBoundaryProperties(
	path: string,
): Promise<BoundaryGeojson> {
	const cached = PROPERTIES_CACHE.get(path);
	if (cached) return Promise.resolve(cached);
	const pending = PROPERTIES_PENDING.get(path);
	if (pending) return pending;

	const promise = fetch(path)
		.then(async (response) => {
			if (!response.ok) {
				throw new Error(
					`Failed to fetch ${path}: ${response.status} ${response.statusText}`,
				);
			}
			return decodeProperties(await response.json());
		})
		.then((data) => {
			PROPERTIES_CACHE.set(path, data);
			PROPERTIES_PENDING.delete(path);
			return data;
		});
	PROPERTIES_PENDING.set(path, promise);
	promise.catch(() => PROPERTIES_PENDING.delete(path));
	return promise;
}
