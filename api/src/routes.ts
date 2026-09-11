import type { AreaLookup } from "./areaInventory";
import type { BoundaryRegistry } from "./boundaryRegistry";
import type { GeographyInventory } from "./geographyInventory";

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
): ApiResponse => {
	if (method !== "GET") {
		return problem(405, "Method Not Allowed", "This API is read-only.");
	}

	const pathname = new URL(url ?? "/", "http://localhost").pathname;
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

	return problem(404, "Not Found", "No API resource matches that path.");
};
