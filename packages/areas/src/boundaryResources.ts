import {
	BOUNDARY_CATALOG,
	BOUNDARY_TYPES,
} from "@uk-data-atlas/datasets/data/boundaries/catalog";

export type BoundaryResource = { href: string; bytes: number } & (
	{ method: "shared-arcs" } | { method: "compiled-polygons"; reason: string }
);

export type BoundaryResources = {
	schemaVersion: 2;
	minZoom: number;
	maxZoom: number;
	releases: Record<string, BoundaryResource>;
};

export const websiteBoundaryReleases = () =>
	BOUNDARY_TYPES.flatMap((type) =>
		BOUNDARY_CATALOG[type].releases.flatMap((release) =>
			release.asset
				? [{ key: `${type}/${release.id}`, asset: release.asset }]
				: [],
		),
	);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** Legacy URLs are accepted during the first content-hashed release. */
const validArchiveHref = (asset: string, href: unknown) => {
	if (typeof href !== "string") return false;
	const legacy = asset.replace(/\.topojson$/, ".pmtiles");
	if (href === legacy) return true;
	const directory = legacy.slice(0, legacy.lastIndexOf("/") + 1);
	return (
		href.startsWith(directory) &&
		/^[a-f0-9]{64}\.pmtiles$/.test(href.slice(directory.length))
	);
};

/** Parse map resources without allowing arbitrary URLs or unknown releases. */
export function parseBoundaryResources(value: unknown): BoundaryResources {
	if (
		!isRecord(value) ||
		value.schemaVersion !== 2 ||
		typeof value.minZoom !== "number" ||
		!Number.isInteger(value.minZoom) ||
		typeof value.maxZoom !== "number" ||
		!Number.isInteger(value.maxZoom) ||
		value.minZoom < 0 ||
		value.maxZoom < value.minZoom ||
		value.maxZoom > 24 ||
		!isRecord(value.releases)
	)
		throw new Error(
			"Invalid boundary resources manifest. Run pnpm data:build.",
		);
	const assets = new Map(
		websiteBoundaryReleases().map(({ key, asset }) => [key, asset]),
	);
	const releases: Record<string, BoundaryResource> = {};
	for (const [key, entry] of Object.entries(value.releases)) {
		const asset = assets.get(key);
		if (
			!asset ||
			!isRecord(entry) ||
			(entry.method !== "shared-arcs" &&
				entry.method !== "compiled-polygons") ||
			!validArchiveHref(asset, entry.href) ||
			typeof entry.bytes !== "number" ||
			!Number.isSafeInteger(entry.bytes) ||
			entry.bytes <= 0
		)
			throw new Error(`Invalid boundary resource: ${key}`);
		if (entry.method === "compiled-polygons") {
			if (typeof entry.reason !== "string" || !entry.reason.trim())
				throw new Error(`Missing compiled polygon reason: ${key}`);
			releases[key] = {
				method: "compiled-polygons",
				href: String(entry.href),
				bytes: entry.bytes,
				reason: entry.reason,
			};
		} else
			releases[key] = {
				method: "shared-arcs",
				href: String(entry.href),
				bytes: entry.bytes,
			};
	}
	return {
		schemaVersion: 2,
		minZoom: value.minZoom,
		maxZoom: value.maxZoom,
		releases,
	};
}

export function assertCompleteBoundaryResources(
	manifest: BoundaryResources,
): void {
	for (const { key } of websiteBoundaryReleases())
		if (!manifest.releases[key])
			throw new Error(
				`Missing boundary map resource: ${key}. Run pnpm data:build.`,
			);
}
