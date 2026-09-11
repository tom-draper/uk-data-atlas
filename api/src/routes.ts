import type { AreaLookup } from "./areaInventory";
import type { AtlasRelease } from "./atlasRelease";
import type { BoundaryRegistry } from "./boundaryRegistry";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "./crosswalkInventory";
import type { GeographyInventory } from "./geographyInventory";

export type CrosswalkLookup = Map<string, CrosswalkArtifact>;

type Envelope<T> = {
	apiVersion: "v1";
	atlasRelease: string;
	data: T;
	meta: { nextCursor: string | null };
};

export type ApiResponse = {
	status: number;
	body: Envelope<unknown> | Problem;
};

type Problem = {
	type: string;
	title: string;
	status: number;
	detail: string;
};

const envelope = <T>(
	atlasRelease: string,
	data: T,
	nextCursor: string | null = null,
): Envelope<T> => ({
	apiVersion: "v1",
	atlasRelease,
	data,
	meta: { nextCursor },
});

const problem = (
	status: number,
	title: string,
	detail: string,
): ApiResponse => ({
	status,
	body: {
		type: `https://api.ukdataatlas.com/problems/${title
			.toLowerCase()
			.replaceAll(" ", "-")}`,
		title,
		status,
		detail,
	},
});

const decodePathSegment = (segment: string) => {
	try {
		return decodeURIComponent(segment);
	} catch {
		return undefined;
	}
};

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

const readPageSize = (value: string | null): number | undefined => {
	if (value === null) return DEFAULT_PAGE_SIZE;
	if (!/^[1-9]\d*$/.test(value)) return undefined;
	const size = Number(value);
	return size <= MAX_PAGE_SIZE ? size : undefined;
};

const cursorFor = (code: string) => Buffer.from(code).toString("base64url");

const codeFromCursor = (cursor: string): string | undefined => {
	try {
		const code = Buffer.from(cursor, "base64url").toString("utf8");
		return code.length > 0 && cursorFor(code) === cursor ? code : undefined;
	} catch {
		return undefined;
	}
};

export type AreaSearchResult = {
	id: string;
	geography: string;
	boundaryRelease: string;
	code: string;
	name: string;
	aliases?: string[];
};

const searchableAreas = (areaLookup: AreaLookup): AreaSearchResult[] =>
	[...areaLookup.entries()]
		.flatMap(([identity, areas]) => {
			const slash = identity.indexOf("/");
			const geography = identity.slice(0, slash);
			const boundaryRelease = identity.slice(slash + 1);
			return [...areas.values()].map((area) => ({
				id: [geography, boundaryRelease, area.code].join("/"),
				geography,
				boundaryRelease,
				...area,
			}));
		})
		.sort((left, right) => left.id.localeCompare(right.id));

export type AreaSearchIndex = AreaSearchResult[];

export const createAreaSearchIndex = (
	areaLookup: AreaLookup,
): AreaSearchIndex => searchableAreas(areaLookup);

const matchesAreaQuery = (area: AreaSearchResult, query: string) => {
	const normalizedQuery = query.toLocaleLowerCase();
	return (
		area.code.toLocaleLowerCase().startsWith(normalizedQuery) ||
		area.name.toLocaleLowerCase().startsWith(normalizedQuery) ||
		area.aliases?.some((alias) =>
			alias.toLocaleLowerCase().startsWith(normalizedQuery),
		) === true
	);
};

export const route = (
	method: string | undefined,
	url: string | undefined,
	registry: BoundaryRegistry,
	geographyInventory?: GeographyInventory,
	areaLookup?: AreaLookup,
	crosswalkInventory?: CrosswalkInventory,
	crosswalkLookup?: CrosswalkLookup,
	atlasRelease?: AtlasRelease,
	areaSearchIndex?: AreaSearchIndex,
): ApiResponse => {
	const releaseId = atlasRelease?.releaseId ?? registry.contentHash;
	if (method !== "GET") {
		return problem(405, "Method Not Allowed", "This API is read-only.");
	}

	const parsedUrl = new URL(url ?? "/", "http://localhost");
	const pathname = parsedUrl.pathname;
	const segments = pathname.split("/").filter(Boolean).map(decodePathSegment);
	if (segments.some((segment) => segment === undefined)) {
		return problem(
			400,
			"Invalid Path",
			"The request path contains invalid encoding.",
		);
	}

	if (segments.length === 1 && segments[0] === "v1") {
		return {
			status: 200,
			body: envelope(releaseId, {
				name: "UK Data Atlas API",
				links: [
					"/v1/geographies",
					"/v1/boundary-releases",
					"/v1/geography-inventory",
					"/v1/areas",
					"/v1/areas/{type}/{release}/{code}",
					"/v1/crosswalks",
					"/v1/crosswalks/{crosswalk-id}",
					"/v1/crosswalks/{crosswalk-id}/records",
					"/v1/atlas-release",
				],
			}),
		};
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "geographies"
	) {
		const releasesByGeography = new Map<
			string,
			BoundaryRegistry["releases"]
		>();
		for (const release of registry.releases) {
			const releases = releasesByGeography.get(release.geography) ?? [];
			releases.push(release);
			releasesByGeography.set(release.geography, releases);
		}
		const geographies = [...releasesByGeography.entries()]
			.map(([id, releases]) => ({
				id,
				latestRelease: releases[0].id,
				releaseCount: releases.length,
			}))
			.sort((left, right) => left.id.localeCompare(right.id));
		return { status: 200, body: envelope(releaseId, geographies) };
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "areas"
	) {
		if (!areaLookup) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the area inventory before searching areas.",
			);
		}
		const geography = parsedUrl.searchParams.get("geography");
		const boundaryRelease = parsedUrl.searchParams.get("release");
		const query = parsedUrl.searchParams.get("q")?.trim();
		const filtered = (
			areaSearchIndex ?? searchableAreas(areaLookup)
		).filter(
			(area) =>
				(geography === null || area.geography === geography) &&
				(boundaryRelease === null ||
					area.boundaryRelease === boundaryRelease),
		);
		const exactCodeMatches = query
			? filtered.filter(
					(area) =>
						area.code.toLocaleLowerCase() ===
						query.toLocaleLowerCase(),
				)
			: [];
		const matches = query
			? exactCodeMatches.length > 0
				? exactCodeMatches
				: filtered.filter((area) => matchesAreaQuery(area, query))
			: filtered;
		const pageSize = readPageSize(parsedUrl.searchParams.get("limit"));
		if (pageSize === undefined) {
			return problem(
				400,
				"Invalid Query",
				"limit must be an integer between 1 and " + MAX_PAGE_SIZE + ".",
			);
		}
		const cursor = parsedUrl.searchParams.get("cursor");
		const cursorId = cursor ? codeFromCursor(cursor) : undefined;
		if (cursor && !cursorId) {
			return problem(400, "Invalid Query", "cursor is invalid.");
		}
		const offset = cursorId
			? matches.findIndex((area) => area.id === cursorId) + 1
			: 0;
		if (cursorId && offset === 0) {
			return problem(
				400,
				"Invalid Query",
				"cursor is not valid for this area query.",
			);
		}
		const areas = matches.slice(offset, offset + pageSize);
		const lastArea = areas.at(-1);
		const nextCursor =
			offset + areas.length < matches.length && lastArea
				? cursorFor(lastArea.id)
				: null;
		return { status: 200, body: envelope(releaseId, areas, nextCursor) };
	}

	if (
		segments.length === 5 &&
		segments[0] === "v1" &&
		segments[1] === "areas"
	) {
		const [geography, boundaryRelease, code] = segments.slice(2);
		if (!geography || !boundaryRelease || !code) {
			return problem(
				400,
				"Invalid Path",
				"An area identity is incomplete.",
			);
		}
		const area = areaLookup
			?.get(`${geography}/${boundaryRelease}`)
			?.get(code);
		return area
			? {
					status: 200,
					body: envelope(releaseId, {
						id: `${geography}/${boundaryRelease}/${area.code}`,
						geography,
						boundaryRelease,
						...area,
					}),
				}
			: problem(
					404,
					"Not Found",
					"No compiled area matches that identity.",
				);
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "geography-inventory"
	) {
		return geographyInventory
			? { status: 200, body: envelope(releaseId, geographyInventory) }
			: problem(
					503,
					"Catalogue Unavailable",
					"Build the geography inventory before starting the API.",
				);
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "boundary-releases"
	) {
		return { status: 200, body: envelope(releaseId, registry.releases) };
	}

	if (
		segments.length === 4 &&
		segments[0] === "v1" &&
		segments[1] === "boundary-releases"
	) {
		const release = registry.releases.find(
			(candidate) =>
				candidate.geography === segments[2] &&
				candidate.id === segments[3],
		);
		return release
			? { status: 200, body: envelope(releaseId, release) }
			: problem(
					404,
					"Not Found",
					"No boundary release matches that identity.",
				);
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "crosswalks"
	) {
		return crosswalkInventory
			? {
					status: 200,
					body: envelope(releaseId, crosswalkInventory.crosswalks),
				}
			: problem(
					503,
					"Catalogue Unavailable",
					"Build the crosswalk inventory before starting the API.",
				);
	}

	if (
		segments.length === 3 &&
		segments[0] === "v1" &&
		segments[1] === "crosswalks"
	) {
		const crosswalk = crosswalkLookup?.get(segments[2] as string);
		if (!crosswalk) {
			return problem(
				404,
				"Not Found",
				"No crosswalk matches that identity.",
			);
		}
		const { records, ...metadata } = crosswalk;
		return { status: 200, body: envelope(releaseId, metadata) };
	}

	if (
		segments.length === 4 &&
		segments[0] === "v1" &&
		segments[1] === "crosswalks" &&
		segments[3] === "records"
	) {
		const crosswalk = crosswalkLookup?.get(segments[2] as string);
		if (!crosswalk) {
			return problem(
				404,
				"Not Found",
				"No crosswalk matches that identity.",
			);
		}
		const source = parsedUrl.searchParams.get("source");
		if (source !== null) {
			const records = crosswalk.records.filter(
				(record) => record.source.code === source,
			);
			return { status: 200, body: envelope(releaseId, records) };
		}
		const pageSize = readPageSize(parsedUrl.searchParams.get("limit"));
		if (pageSize === undefined) {
			return problem(
				400,
				"Invalid Query",
				`limit must be an integer between 1 and ${MAX_PAGE_SIZE}.`,
			);
		}
		const cursor = parsedUrl.searchParams.get("cursor");
		const cursorCode = cursor ? codeFromCursor(cursor) : undefined;
		if (cursor && !cursorCode) {
			return problem(400, "Invalid Query", "cursor is invalid.");
		}
		const offset = cursorCode
			? crosswalk.records.findIndex(
					(record) => record.source.code === cursorCode,
				) + 1
			: 0;
		if (cursorCode && offset === 0) {
			return problem(
				400,
				"Invalid Query",
				"cursor is not valid for this crosswalk.",
			);
		}
		const records = crosswalk.records.slice(offset, offset + pageSize);
		const lastRecord = records.at(-1);
		const nextCursor =
			offset + records.length < crosswalk.records.length && lastRecord
				? cursorFor(lastRecord.source.code)
				: null;
		return { status: 200, body: envelope(releaseId, records, nextCursor) };
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "atlas-release"
	) {
		return atlasRelease
			? { status: 200, body: envelope(releaseId, atlasRelease) }
			: problem(
					503,
					"Catalogue Unavailable",
					"Build the atlas release manifest before starting the API.",
				);
	}

	return problem(404, "Not Found", "No API resource matches that path.");
};
