import { isNumericObservation } from "./dataCatalog";
import { featureIds } from "@uk-data-atlas/map-tiles/featureIds";
import type { MapResourceDescriptor } from "@uk-data-atlas/map-tiles/mapResources";
import { untiledFeatures } from "./mapResourceLoader";
import { releaseKey } from "./geographyKeys";
import { observationsFor } from "./observationArtifacts";
import { writeParquet } from "./parquet";
import {
	refused,
	resolveObservations,
} from "./observationResolution/observationPlan";
import {
	envelope,
	invalidQuery,
	problem,
	type ApiResponse,
} from "./routeResponse";
import type { RouteRequest } from "./routing";
import { choices, readChoice } from "./queryParameters";
import { QUERY_RULES } from "./queryRules";

/**
 * The map resources: what is published, what each one is, and the tiles
 * themselves.
 *
 * A descriptor is the only document a client needs: it carries the tile and
 * archive URLs, the zoom ladder, the content hashes and the attribution to
 * display. The tiles are served both one at a time and as the whole archive,
 * because a renderer wants one and a warehouse or an offline map wants the
 * other. For a warehouse or a GIS that holds features rather than tiles, each
 * tier is also served flat, as GeoParquet, and a join table as Parquet.
 */

const MVT_CONTENT_TYPE = "application/vnd.mapbox-vector-tile";
const PMTILES_CONTENT_TYPE = "application/vnd.pmtiles";
const PARQUET_CONTENT_TYPE = "application/vnd.apache.parquet";

export const MAX_MAP_JOIN_ROWS = 250_000;
export const MAX_MAP_JOIN_COLUMN_BYTES = 16 * 1024 * 1024;

const FEATURES =
	QUERY_RULES["GET /map-resources/{geography}/{release}/features"];
const JOIN =
	QUERY_RULES["GET /map-resources/{geography}/{release}/join/{measure-id}"];

/** The whole-release downloads a tier is published in, by `format=`. */
const FEATURE_FORMATS: Record<
	(typeof FEATURES.format.values)[number],
	{ format: string; contentType: string; extension: string }
> = {
	geoparquet: {
		format: "geoparquet-1.1",
		contentType: PARQUET_CONTENT_TYPE,
		extension: "parquet",
	},
	geojson: {
		format: "geojson",
		contentType: "application/geo+json",
		extension: "geojson",
	},
};

const unavailable = () =>
	problem(
		503,
		"Catalogue Unavailable",
		"Build the map resources before requesting them.",
	);

/** One tier of a release, whole, in the format asked for. */
const featureDownload = (
	context: RouteRequest["context"],
	releaseId: string,
	parsedUrl: URL,
	features: MapResourceDescriptor["features"],
	geography: string,
	release: string,
	topology: "shared-arc" | "none",
): ApiResponse => {
	const tier = readChoice(parsedUrl.searchParams.get("tier"), FEATURES.tier);
	// Like a join's period, the detail is the caller's to choose: the finest
	// is twenty times the coarsest, and neither is a safe default for both a
	// warehouse and a web page.
	if (!tier)
		return invalidQuery(
			`Ask for the detail to download with tier=, one of ${FEATURES.tier.values.join(", ")}.`,
		);
	const format = readChoice(
		parsedUrl.searchParams.get("format"),
		FEATURES.format,
	);
	if (!format)
		return invalidQuery(`format must be ${choices(FEATURES.format)}.`, {
			code: "invalid_format",
		});
	const download = FEATURE_FORMATS[format];
	const entry = features.find(
		(candidate) =>
			candidate.tier === tier && candidate.format === download.format,
	);
	if (!entry) {
		const tiers = [
			...new Set(
				features
					.filter((candidate) => candidate.format === download.format)
					.map((candidate) => candidate.tier),
			),
		];
		const otherFormat = features.some(
			(candidate) => candidate.tier === tier,
		);
		return problem(
			404,
			"Not Found",
			otherFormat
				? `${geography}/${release} at tier ${tier} is published as GeoParquet only. GeoJSON is published at ${tiers.join(", ") || "no tier"} of this release.`
				: `${geography}/${release} is downloadable at ${[...new Set(features.map((candidate) => candidate.tier))].join(", ")} only: its areas are not a coverage, so they cannot be generalised together without opening gaps between them.`,
		);
	}
	if (!entry.artifact) {
		const built = context.fullDetailDownloads?.get(
			geography,
			release,
			topology,
			entry.contentHash,
		);
		if (built?.status === "stale")
			return problem(
				503,
				"Catalogue Unavailable",
				"The geometry store no longer matches the published map resources. Rebuild the map resources.",
			);
		if (built?.status !== "built") return unavailable();
		return {
			status: 200,
			body: envelope(releaseId, entry),
			representation: {
				contentType: download.contentType,
				body: built.body,
				contentHash: entry.contentHash,
				headers: {
					"content-disposition": `attachment; filename="${geography}-${release}-${tier}.${download.extension}"`,
				},
			},
		};
	}
	if (context.mapResources?.assetBaseUrl)
		return {
			status: 307,
			headers: { location: entry.href },
			body: envelope(releaseId, { href: entry.href }),
		};
	const body = context.mapFeatures?.get(entry.artifact);
	if (!body) return unavailable();
	return {
		status: 200,
		body: envelope(releaseId, entry),
		representation: {
			contentType: download.contentType,
			body,
			headers: {
				"content-disposition": `attachment; filename="${geography}-${release}-${tier}.${download.extension}"`,
			},
		},
	};
};

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
	parsedUrl,
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
		(segments.length === 5 && segments[4] === "features") ||
		(segments.length === 6 && segments[4] === "join") ||
		(segments.length === 8 && segments[4] === "tiles");
	if (!known) return undefined;
	if (!mapResources) return unavailable();

	const geography = segments[2]!;
	// The archive hangs off the release itself, so the release segment carries
	// the extension: .../{geography}/{release}.pmtiles.
	const release = asArchive
		? segments[3]!.slice(0, -".pmtiles".length)
		: segments[3]!;
	const id = releaseKey(geography, release);
	const resource = mapResources.resources.find((entry) => entry.id === id);
	if (!resource) {
		// A release that cannot be tiled may still be downloadable whole.
		const untiled = untiledFeatures(mapResources, geography, release);
		if (untiled && segments.length === 5 && segments[4] === "features")
			return featureDownload(
				context,
				releaseId,
				parsedUrl,
				untiled.features!,
				geography,
				release,
				"none",
			);
		return notFound(geography, release);
	}
	const origin = mapResources.tileBaseUrl
		? `${mapResources.tileBaseUrl}/${id}`
		: `/v1/map-resources/${id}`;

	if (asArchive) {
		if (mapResources.assetBaseUrl)
			return {
				status: 307,
				headers: { location: resource.tiles.href },
				body: envelope(releaseId, { href: resource.tiles.href }),
			};
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
				body: {
					path: archive.path,
					bytes: resource.tiles.bytes,
					contentHash: resource.tiles.contentHash,
				},
				headers: {
					"content-disposition": `attachment; filename="${geography}-${release}.pmtiles"`,
				},
			},
		};
	}

	if (segments.length === 4)
		return {
			status: 200,
			body: envelope(releaseId, resource),
		};

	if (segments.length === 5 && segments[4] === "tiles.json") {
		if (mapResources.assetBaseUrl && !mapResources.tileBaseUrl)
			return problem(
				503,
				"Tile Service Unavailable",
				`Use the PMTiles archive at ${resource.tiles.href}, or configure ATLAS_MAP_TILE_BASE_URL.`,
			);
		return {
			status: 200,
			body: envelope(releaseId, tileJson(resource, origin)),
		};
	}

	if (segments.length === 5 && segments[4] === "features")
		return featureDownload(
			context,
			releaseId,
			parsedUrl,
			resource.features,
			geography,
			release,
			"shared-arc",
		);

	if (segments.length === 6 && segments[4] === "join") {
		const measureId = segments[5]!;
		const format = readChoice(
			parsedUrl.searchParams.get("format"),
			JOIN.format,
		);
		if (!format)
			return invalidQuery(`format must be ${choices(JOIN.format)}.`, {
				code: "invalid_format",
			});
		// The map resource decides the geometry: a value may only be drawn on
		// this release if every source code is in it, which the resolver
		// checks rather than this route.
		const period = parsedUrl.searchParams.get("period");
		// The join documents `period` as required: a map draws one moment, and
		// which moment is the caller's to say.
		if (period === null)
			return invalidQuery(
				`Ask for the period to draw with period=; /v1/measures/${measureId} lists the ones ${measureId} publishes.`,
			);
		const resolved = resolveObservations(context, {
			measureId,
			periods: [period],
			geography: parsedUrl.searchParams.get("geography"),
			boundaryYear: parsedUrl.searchParams.get("codeYear"),
			release,
		});
		if (resolved.kind === "refusal") return refused(resolved.refusal);
		const { plan } = resolved;
		const observations = observationsFor(
			measureId,
			plan.source,
			period,
			context,
		);
		if (!observations)
			return problem(
				503,
				"Catalogue Unavailable",
				`The observations for ${measureId} ${period} are not loaded.`,
			);
		// The ids must be the tiles' ids, so they come from the release's own
		// codes. Numbering the observations instead would drift the moment a
		// measure covered fewer areas than the release holds, and the values
		// would land on the wrong shapes.
		const [geography, boundaryRelease] = id.split("/", 2);
		const areaCodes =
			geography && boundaryRelease
				? context.geographyResolver.areaCodes(
						geography,
						boundaryRelease,
					)
				: undefined;
		if (!areaCodes)
			return problem(
				503,
				"Catalogue Unavailable",
				`The area identities for ${id} are not loaded, so values cannot be numbered to match the tiles.`,
			);
		const records = observations.records;
		const budgetFailure = () =>
			problem(
				422,
				"Map Join Budget Exceeded",
				`Map joins accept at most ${MAX_MAP_JOIN_ROWS} source records and ${MAX_MAP_JOIN_COLUMN_BYTES} uncompressed column bytes. Retrieve source observations in pages from /v1/data/${plan.measure.id} using JSON, CSV or NDJSON. No partial join is returned.`,
				{
					links: {
						data: `/v1/data/${encodeURIComponent(plan.measure.id)}?${new URLSearchParams({ period, geography: plan.source.sourceGeography.type, codeYear: String(plan.source.sourceGeography.boundaryYear), datasetId: plan.source.datasetId })}`,
					},
				},
			);
		if (records.length > MAX_MAP_JOIN_ROWS) return budgetFailure();
		let columnBytes = 0;
		for (const record of records) {
			if (!isNumericObservation(record)) continue;
			columnBytes +=
				20 +
				Buffer.byteLength(record.areaCode, "utf8") +
				Buffer.byteLength(record.status, "utf8");
			if (columnBytes > MAX_MAP_JOIN_COLUMN_BYTES) return budgetFailure();
		}
		const numbered = featureIds(areaCodes);
		const join = {
			measure: { id: plan.measure.id, label: plan.measure.label },
			period,
			sourceGeography: plan.source.sourceGeography,
			join: {
				boundaryRelease: plan.join!.boundaryRelease,
				method: "code-match",
				compatibility: plan.join!.compatibility,
				note: "Values are joined to this geometry by matching area code. No value is converted, and no geometry is asserted to be equal.",
			},
			layer: resource.tiles.layer,
			areasWithoutValue: plan.join!.candidateOnlyCodeCount,
		};
		const provenance = {
			artifact: observations.artifact,
			contentHash: observations.contentHash,
			measure: `/v1/measures/${plan.measure.id}`,
		};
		if (format === "json") {
			const values = records.flatMap((record) =>
				isNumericObservation(record)
					? [
							{
								id: numbered.get(record.areaCode)!,
								code: record.areaCode,
								value: record.value,
								status: record.status,
							},
						]
					: [],
			);
			return {
				status: 200,
				body: envelope(releaseId, { ...join, values, provenance }),
			};
		}
		const ids: number[] = [];
		const codes: string[] = [];
		const values: number[] = [];
		const statuses: string[] = [];
		for (const record of records) {
			if (!isNumericObservation(record)) continue;
			ids.push(numbered.get(record.areaCode)!);
			codes.push(record.areaCode);
			values.push(record.value);
			statuses.push(record.status);
		}

		// The same table as columns. Everything the envelope says about it
		// travels in the file's metadata, so a copy loaded into a warehouse on
		// its own still names its release, its source and its join rule.
		return {
			status: 200,
			body: envelope(releaseId, { ...join, provenance }),
			representation: {
				contentType: PARQUET_CONTENT_TYPE,
				body: writeParquet({
					columns: [
						{
							name: "id",
							type: "int32",
							values: ids,
						},
						{
							name: "code",
							type: "string",
							values: codes,
						},
						{
							name: "value",
							type: "double",
							values,
						},
						{
							name: "status",
							type: "string",
							values: statuses,
						},
					],
					metadata: {
						"uk-data-atlas": JSON.stringify({
							atlasRelease: releaseId,
							mapResource: id,
							...join,
							provenance,
						}),
					},
				}),
				headers: {
					"content-disposition": `attachment; filename="${geography}-${release}-${measureId}-${period}.parquet"`,
				},
			},
		};
	}

	if (segments.length === 8 && segments[4] === "tiles") {
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
		if (mapResources.tileBaseUrl)
			return {
				status: 307,
				headers: { location: `${origin}/tiles/${z}/${x}/${y}.mvt` },
				body: envelope(releaseId, {
					href: `${origin}/tiles/${z}/${x}/${y}.mvt`,
				}),
			};
		const archive = mapArchives?.get(id);
		if (!archive) return unavailable();
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
