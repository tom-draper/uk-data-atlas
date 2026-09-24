import { decodeBoundaryData } from "../data/boundaries/decode";
import { filterFeatures } from "../data/boundaries/filter";
import {
	BOUNDARY_CATALOG,
	BOUNDARY_TYPES,
	type BoundaryType,
} from "../data/boundaries/catalog";
import type { Crosswalk } from "../data/gazetteer/types";
import { parsePrecompiledBoundaryMappings } from "../data/boundaries/mappings";
import {
	fetchLsoaToLad,
	lsoaYearForBoundaryAsset,
} from "../data/boundaries/lsoaLadMappings";
import { withCDN } from "../helpers/cdn";
import { getProp } from "../data/boundaries/properties";

interface Request {
	id: number;
	url: string;
	filter?: {
		type?: BoundaryType;
		location?: string | null;
		relations?: { constituencyLadOverlaps?: Crosswalk };
	};
}

const BOUNDARY_TYPE_SET = new Set<string>(BOUNDARY_TYPES);

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
					typeof target.weight === "number",
			),
	);

const isWorkerRequest = (value: unknown): value is Request => {
	if (
		!isRecord(value) ||
		typeof value.id !== "number" ||
		!Number.isSafeInteger(value.id) ||
		value.id < 0 ||
		typeof value.url !== "string"
	)
		return false;
	if (value.filter === undefined) return true;
	if (!isRecord(value.filter)) return false;
	const filter = value.filter;
	if (
		(filter.type !== undefined &&
			(typeof filter.type !== "string" ||
				!BOUNDARY_TYPE_SET.has(filter.type))) ||
		(filter.location !== undefined &&
			filter.location !== null &&
			typeof filter.location !== "string")
	)
		return false;
	if (filter.relations === undefined) return true;
	return (
		isRecord(filter.relations) &&
		(filter.relations.constituencyLadOverlaps === undefined ||
			isCrosswalk(filter.relations.constituencyLadOverlaps))
	);
};

interface Response {
	id: number;
	data?: unknown;
	error?: string;
}

const BOUNDARY_MAPPINGS_URL = withCDN("/data/datasets/boundary-mappings.json");
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
			const mappings = parsePrecompiledBoundaryMappings(
				await response.json(),
			);
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

self.addEventListener("message", async (event: MessageEvent<unknown>) => {
	if (!isWorkerRequest(event.data)) return;
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
		const workerLsoaToLad =
			filterType === "lsoa" &&
			filter?.location &&
			!COUNTRY_LOCATIONS.has(filter.location)
				? await fetchLsoaToLad(
						lsoaYearForBoundaryAsset(url) ?? NaN,
					).catch(() => undefined)
				: undefined;
		const filtered =
			filterType === undefined
				? data
				: filterFeatures(data, {
						location: filter?.location ?? null,
						type: filterType,
						relations: {
							getLadForWard: workerWardToLad
								? (wardCode) => workerWardToLad[wardCode]
								: undefined,
							constituencyLadOverlaps:
								filter?.relations?.constituencyLadOverlaps,
							lsoaToLad: workerLsoaToLad,
						},
					});
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
