import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/**
 * The map resources: what is published, what each one is, and the tiles
 * themselves.
 *
 * A descriptor is the only document a client needs: it carries the tile and
 * archive URLs, the zoom ladder, the content hashes and the attribution to
 * display. The tiles are served both one at a time and as the whole archive,
 * because a renderer wants one and a warehouse or an offline map wants the
 * other.
 */

const MVT_CONTENT_TYPE = "application/vnd.mapbox-vector-tile";
const PMTILES_CONTENT_TYPE = "application/vnd.pmtiles";

const unavailable = () =>
	problem(
		503,
		"Catalogue Unavailable",
		"Build the map resources before requesting them.",
	);

const notFound = (geography: string, release: string) =>
	problem(
		404,
		"Not Found",
		`No map resource is published for ${geography}/${release}. Ask /v1/map-resources for the ones that are.`,
	);

/**
 * TileJSON 3.0, which is what a renderer is configured with. It repeats the
 * attribution: a tile cannot carry a licence, and a client handed only a tile
 * URL would have nothing to display beside the map.
 */
const tileJson = (
	resource: {
		id: string;
		title: string;
		bounds: [number, number, number, number];
		tiles: {
			layer: string;
			minZoom: number;
			maxZoom: number;
			contentHash: string;
		};
		attribution: { text: string };
	},
	origin: string,
) => ({
	tilejson: "3.0.0",
	name: resource.id,
	description: resource.title,
	attribution: resource.attribution.text,
	scheme: "xyz",
	format: "pbf",
	tiles: [`${origin}/tiles/{z}/{x}/{y}.mvt`],
	minzoom: resource.tiles.minZoom,
	maxzoom: resource.tiles.maxZoom,
	bounds: resource.bounds,
	center: [
		(resource.bounds[0] + resource.bounds[2]) / 2,
		(resource.bounds[1] + resource.bounds[3]) / 2,
		resource.tiles.minZoom,
	],
	vector_layers: [
		{
			id: resource.tiles.layer,
			description: resource.title,
			minzoom: resource.tiles.minZoom,
			maxzoom: resource.tiles.maxZoom,
			fields: { code: "String", name: "String" },
		},
	],
	// Not part of TileJSON, and the reason a cited map can be checked.
	"x-content-hash": resource.tiles.contentHash,
});

export const handleMapResourceRoutes = ({
	context,
	releaseId,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (segments[0] !== "v1" || segments[1] !== "map-resources")
		return undefined;
	const { mapResources, mapArchives } = context;

	if (segments.length === 2) {
		if (!mapResources) return unavailable();
		return {
			status: 200,
			body: envelope(
				releaseId,
				mapResources.resources.map((resource) => ({
					id: resource.id,
					geography: resource.geography,
					boundaryRelease: resource.boundaryRelease,
					title: resource.title,
					href: `/v1/map-resources/${resource.id}`,
				})),
			),
		};
	}
	// The shape of the path decides whether this family answers at all, before
	// any resource is looked up: a path this family does not serve is not this
	// family's 404 to give, or an unbuilt route would look like a missing
	// resource.
	const asArchive =
		segments.length === 4 && segments[3]!.endsWith(".pmtiles");
	const known =
		asArchive ||
		segments.length === 4 ||
		(segments.length === 5 && segments[4] === "tiles.json") ||
		(segments.length === 8 && segments[4] === "tiles");
	if (!known) return undefined;
	if (!mapResources) return unavailable();

	const geography = segments[2]!;
	// The archive hangs off the release itself, so the release segment carries
	// the extension: .../{geography}/{release}.pmtiles.
	const release = asArchive
		? segments[3]!.slice(0, -".pmtiles".length)
		: segments[3]!;
	const id = `${geography}/${release}`;
	const resource = mapResources.resources.find((entry) => entry.id === id);
	if (!resource) return notFound(geography, release);
	const origin = `/v1/map-resources/${id}`;

	if (asArchive) {
		const archive = mapArchives?.get(id);
		if (!archive) return unavailable();
		return {
			status: 200,
			body: envelope(releaseId, {
				id,
				format: "pmtiles-3",
				bytes: resource.tiles.bytes,
				contentHash: resource.tiles.contentHash,
			}),
			representation: {
				contentType: PMTILES_CONTENT_TYPE,
				body: archive.archive,
				headers: {
					"content-disposition": `attachment; filename="${geography}-${release}.pmtiles"`,
				},
			},
		};
	}

	if (segments.length === 4)
		return { status: 200, body: envelope(releaseId, resource) };

	if (segments.length === 5 && segments[4] === "tiles.json")
		return {
			status: 200,
			body: envelope(releaseId, tileJson(resource, origin)),
		};

	if (segments.length === 8 && segments[4] === "tiles") {
		const archive = mapArchives?.get(id);
		if (!archive) return unavailable();
		const name = segments[7]!;
		if (!name.endsWith(".mvt"))
			return problem(
				404,
				"Not Found",
				`A tile is served as .mvt, not as ${name}.`,
			);
		const parts = [
			segments[5]!,
			segments[6]!,
			name.slice(0, -".mvt".length),
		];
		if (!parts.every((part) => /^\d+$/.test(part)))
			return problem(
				400,
				"Invalid Tile",
				"A tile address is three whole numbers, z/x/y.",
			);
		const [z, x, y] = parts.map(Number) as [number, number, number];
		if (z < resource.tiles.minZoom || z > resource.tiles.maxZoom)
			return problem(
				404,
				"Not Found",
				`This resource publishes zoom ${resource.tiles.minZoom} to ${resource.tiles.maxZoom}, not ${z}. A renderer should over-zoom past the last one.`,
			);
		const tile = archive.tile(z, x, y);
		// Inside the published zooms and covering no area: an ordinary answer
		// for a renderer, so it is empty rather than a failure.
		if (!tile)
			return {
				status: 204,
				body: envelope(releaseId, null),
				representation: {
					contentType: MVT_CONTENT_TYPE,
					body: Buffer.alloc(0),
				},
			};
		return {
			status: 200,
			body: envelope(releaseId, null),
			representation: {
				contentType: MVT_CONTENT_TYPE,
				body: tile,
				// Stored gzipped and served as stored, which every renderer
				// that speaks vector tiles accepts.
				headers: { "content-encoding": "gzip" },
			},
		};
	}
	return undefined;
};
