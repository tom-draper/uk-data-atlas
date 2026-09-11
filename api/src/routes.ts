import type { AreaLookup } from "./areaInventory";
import type { AtlasRelease } from "./atlasRelease";
import type { BoundaryRegistry } from "./boundaryRegistry";
import type { CrosswalkArtifact, CrosswalkInventory } from "./crosswalkInventory";
import type { GeographyInventory } from "./geographyInventory";

export type CrosswalkLookup = Map<string, CrosswalkArtifact>;

type Envelope<T> = {
	apiVersion: "v1";
	atlasRelease: string;
	data: T;
	meta: { nextCursor: null };
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

const envelope = <T>(registry: BoundaryRegistry, data: T): Envelope<T> => ({
	apiVersion: "v1",
	atlasRelease: registry.contentHash,
	data,
	meta: { nextCursor: null },
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

export const route = (
	method: string | undefined,
	url: string | undefined,
	registry: BoundaryRegistry,
	geographyInventory?: GeographyInventory,
	areaLookup?: AreaLookup,
	crosswalkInventory?: CrosswalkInventory,
	crosswalkLookup?: CrosswalkLookup,
	atlasRelease?: AtlasRelease,
): ApiResponse => {
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
			body: envelope(registry, {
				name: "UK Data Atlas API",
				links: [
					"/v1/geographies",
					"/v1/boundary-releases",
					"/v1/geography-inventory",
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
		return { status: 200, body: envelope(registry, geographies) };
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
					body: envelope(registry, {
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
			? { status: 200, body: envelope(registry, geographyInventory) }
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
		return { status: 200, body: envelope(registry, registry.releases) };
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
			? { status: 200, body: envelope(registry, release) }
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
			? { status: 200, body: envelope(registry, crosswalkInventory.crosswalks) }
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
		return { status: 200, body: envelope(registry, metadata) };
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
		const records = source
			? crosswalk.records.filter((record) => record.source.code === source)
			: crosswalk.records;
		return { status: 200, body: envelope(registry, records) };
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "atlas-release"
	) {
		return atlasRelease
			? { status: 200, body: envelope(registry, atlasRelease) }
			: problem(
					503,
					"Catalogue Unavailable",
					"Build the atlas release manifest before starting the API.",
				);
	}

	return problem(404, "Not Found", "No API resource matches that path.");
};
