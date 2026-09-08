import { decodeBoundaryData } from "../data/boundaries/decode";
import { filterFeatures } from "../data/boundaries/filter";
import {
	BOUNDARY_CATALOG,
	type BoundaryType,
} from "../data/boundaries/catalog";
import type { Crosswalk } from "../data/gazetteer/types";
import type { PrecompiledBoundaryMappings } from "../data/boundaries/mappings";
import { withCDN } from "../helpers/cdn";
import { getProp } from "../data/boundaries/properties";

interface Request {
	id: number;
	url: string;
	filter?: {
		type?: BoundaryType;
		location?: string | null;
		constituencyLadOverlaps?: Crosswalk;
	};
}

interface Response {
	id: number;
	data?: unknown;
	error?: string;
}

const BOUNDARY_MAPPINGS_URL = withCDN(
	"/data/precompiled/boundary-mappings.json",
);
const COUNTRY_LOCATIONS = new Set([
	"England",
	"Scotland",
	"Wales",
	"Northern Ireland",
	"United Kingdom",
]);
let wardToLad: Record<string, string> | null = null;
let wardToLadPending: Promise<Record<string, string>> | null = null;

const fetchWardToLad = (): Promise<Record<string, string>> => {
	if (wardToLad) return Promise.resolve(wardToLad);
	if (wardToLadPending) return wardToLadPending;

	wardToLadPending = fetch(BOUNDARY_MAPPINGS_URL)
		.then(async (response) => {
			if (!response.ok) {
				throw new Error(
					`Failed to fetch ward/LAD mappings: ${response.status} ${response.statusText}`,
				);
			}
			const mappings =
				(await response.json()) as PrecompiledBoundaryMappings;
			return mappings.wardToLad;
		})
		.then((mappings) => {
			wardToLad = mappings;
			wardToLadPending = null;
			return mappings;
		})
		.catch((error) => {
			wardToLadPending = null;
			throw error;
		});

	return wardToLadPending;
};

const wardReleaseNeedsLadMapping = (
	data: ReturnType<typeof decodeBoundaryData>,
) =>
	data.features.some(
		(feature) =>
			!getProp(
				feature.properties,
				BOUNDARY_CATALOG.ward.properties.parentCode ??
					BOUNDARY_CATALOG.localAuthority.properties.code,
			),
	);

self.addEventListener("message", async (event: MessageEvent<Request>) => {
	const { id, url, filter } = event.data;
	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`${response.status} ${response.statusText}`);
		}
		const data = decodeBoundaryData(await response.json());
		const filterType = filter?.type;
		const workerWardToLad =
			filterType === "ward" &&
			filter?.location &&
			!COUNTRY_LOCATIONS.has(filter.location) &&
			wardReleaseNeedsLadMapping(data)
				? await fetchWardToLad().catch(() => undefined)
				: undefined;
		const filtered =
			filterType === undefined
				? data
				: filterFeatures(
						data,
						filter?.location ?? null,
						filterType,
						workerWardToLad
							? (wardCode) => workerWardToLad[wardCode]
							: undefined,
						filter?.constituencyLadOverlaps,
					);
		(self as unknown as Worker).postMessage({
			id,
			data: filtered,
		} satisfies Response);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		(self as unknown as Worker).postMessage({
			id,
			error: message,
		} satisfies Response);
	}
});
