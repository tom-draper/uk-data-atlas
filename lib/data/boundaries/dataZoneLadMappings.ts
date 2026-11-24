import { atlasLookupUrl } from "../../helpers/atlasData";

/** The data zones of one release, listed under the council holding each. */
export type DataZoneRelease = {
	boundaryYear: number;
	release: string;
	ladToDataZones: Record<string, string[]>;
};

/** The data zones a council holds, in the release they are published on. */
export type CouncilDataZones = {
	boundaryYear: number;
	zones: readonly string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isZoneLists = (value: unknown): value is Record<string, string[]> =>
	isRecord(value) &&
	Object.values(value).every(
		(zones) =>
			Array.isArray(zones) &&
			zones.every((zone) => typeof zone === "string"),
	);

const isRelease = (value: unknown): value is DataZoneRelease =>
	isRecord(value) &&
	typeof value.boundaryYear === "number" &&
	typeof value.release === "string" &&
	isZoneLists(value.ladToDataZones);

export const parseDataZoneLadMappings = (value: unknown): DataZoneRelease[] => {
	if (
		!isRecord(value) ||
		value.version !== 1 ||
		!Array.isArray(value.releases) ||
		!value.releases.every(isRelease)
	)
		throw new Error("Invalid data zone/LAD mapping");
	return value.releases;
};

/**
 * The data zones of a council, from the newest release that lists it. Each
 * nation publishes its small-area census on its own zones, so a council has
 * one release to read it from.
 */
export const councilDataZones = (
	releases: readonly DataZoneRelease[],
	ladCode: string,
): CouncilDataZones | undefined => {
	const release = [...releases]
		.sort((a, b) => b.boundaryYear - a.boundaryYear)
		.find(({ ladToDataZones }) => ladToDataZones[ladCode]?.length);
	return release
		? {
				boundaryYear: release.boundaryYear,
				zones: release.ladToDataZones[ladCode]!,
			}
		: undefined;
};

let pending: Promise<DataZoneRelease[]> | undefined;

/**
 * Scotland and Northern Ireland publish their small-area census on data
 * zones. This lookup, compiled by the API from its crosswalks, lists the
 * zones each council holds so a council's figure can be summed from them.
 */
export const fetchDataZoneLadMappings = (): Promise<DataZoneRelease[]> => {
	if (pending) return pending;
	const request = fetch(atlasLookupUrl("data-zone-lad-mappings"))
		.then(async (response) => {
			if (!response.ok)
				throw new Error(
					`Failed to fetch data zone/LAD mappings: ${response.status} ${response.statusText}`,
				);
			return parseDataZoneLadMappings(await response.json());
		})
		.catch((error) => {
			pending = undefined;
			throw error;
		});
	pending = request;
	return request;
};
