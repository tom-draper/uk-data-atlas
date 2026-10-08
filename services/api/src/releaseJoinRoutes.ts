import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { areaNotFound } from "./areaResources";
import type { ValidatedValue } from "./batchValidation";
import { releaseKey } from "./geographyKeys";
import { featureIds } from "./mapResource/compileMapResource";
import { readPostedRows, type RowValue } from "./requestRows";
import {
	envelope,
	invalidQuery,
	problem,
	type ApiResponse,
} from "./routeResponse";
import type { RouteRequest } from "./routing";
import { GEOMETRY_TIERS, type GeometryTier } from "./simplifyGeometry";

/**
 * Join a caller's own rows to a boundary release: send a column of codes or
 * names with a value each, and get back the values numbered as the release's
 * tiles and downloads number their features, or the joined areas as GeoJSON.
 *
 * Nothing is stored and nothing is guessed. Each row is read by the same
 * validator as `areas:validate`, so a code the release does not hold, a
 * name that means several areas, or a second row for an area already given
 * one is left out of the join and returned with its reason.
 */

const JOIN_SUFFIX = ":join";

// The largest stored GeoJSON tier read to answer one request. Past this the
// join table and the tiles, or a GeoParquet download, draw the same map
// without parsing a whole release per request.
export const MAX_GEOJSON_JOIN_BYTES = 64 * 1024 * 1024;

const GEOJSON_TIERS = Object.keys(GEOMETRY_TIERS).join(", ");

const isGeometryTier = (tier: string): tier is GeometryTier =>
	tier in GEOMETRY_TIERS;

/** The release a join path names, or undefined when it is not a join path. */
export const joinRelease = (segments: string[]) =>
	segments.length === 4 &&
	segments[0] === "v1" &&
	segments[1] === "boundary-releases" &&
	segments[3]!.endsWith(JOIN_SUFFIX) &&
	segments[3]!.length > JOIN_SUFFIX.length
		? {
				geography: segments[2]!,
				release: segments[3]!.slice(0, -JOIN_SUFFIX.length),
			}
		: undefined;

type Unjoined = {
	index: number;
	area: string;
	reason: "duplicate-area" | ValidatedValue["status"];
	/** For a duplicate, the row whose area this one repeats. */
	sameAreaAs?: number;
	validation?: Omit<ValidatedValue, "index" | "value">;
};

/** The area a validated row names, when it names exactly one. */
const joinedArea = (entry: ValidatedValue) =>
	(entry.kind === "code" && entry.status === "valid") ||
	(entry.kind === "name" && entry.status === "matched")
		? entry.area
		: undefined;

export const handleReleaseJoinRoutes = (
	request: RouteRequest,
): ApiResponse | undefined => {
	const target = joinRelease(request.segments);
	if (!target) return undefined;
	const { context, releaseId, parsedUrl, method, body } = request;
	const { geography, release } = target;
	if (method !== "POST")
		return problem(
			405,
			"Method Not Allowed",
			"A join reads your rows from the request body, so it is a POST. Send JSON or CSV with an area column and a value column.",
		);
	const format = parsedUrl.searchParams.get("format") ?? "json";
	if (format !== "json" && format !== "geojson")
		return invalidQuery("format must be json or geojson.");
	const tier = parsedUrl.searchParams.get("tier") ?? "medium";
	if (format === "geojson" && !isGeometryTier(tier))
		return invalidQuery(`tier must be one of ${GEOJSON_TIERS}.`);

	const rows = readPostedRows(body, { withValues: true });
	if ("status" in rows) return rows;
	if (rows.parents && rows.parents.length !== rows.areas.length)
		return problem(
			400,
			"Invalid Body",
			"parent, when sent, must be given for every row.",
		);
	const validated = context.geographyResolver.validateAreas(
		geography,
		release,
		rows.areas,
		rows.parents,
	);
	if (!validated) return areaNotFound(context, geography, release);
	const areaCodes = context.geographyResolver.areaCodes(geography, release);
	if (!areaCodes)
		return problem(
			503,
			"Catalogue Unavailable",
			`The area identities for ${geography}/${release} are not loaded.`,
		);
	const numbered = featureIds(areaCodes);

	// One value per area. A second row for an area leaves the area out
	// altogether: which of two values a caller meant is theirs to say.
	const rowsByCode = new Map<string, number[]>();
	for (const entry of validated.values) {
		const area = joinedArea(entry);
		if (area)
			rowsByCode.set(area.code, [
				...(rowsByCode.get(area.code) ?? []),
				entry.index,
			]);
	}
	const values: Array<{
		id: number;
		code: string;
		name: string;
		value: RowValue;
	}> = [];
	const unjoined: Unjoined[] = [];
	for (const entry of validated.values) {
		const area = joinedArea(entry);
		const { index, value: _value, ...validation } = entry;
		if (!area) {
			unjoined.push({
				index,
				area: rows.areas[index]!,
				reason: entry.status,
				validation,
			});
			continue;
		}
		const sameArea = rowsByCode.get(area.code)!;
		if (sameArea.length > 1) {
			unjoined.push({
				index,
				area: rows.areas[index]!,
				reason: "duplicate-area",
				...(sameArea[0] !== index ? { sameAreaAs: sameArea[0] } : {}),
			});
			continue;
		}
		values.push({
			id: numbered.get(area.code)!,
			code: area.code,
			name: area.name,
			value: rows.values![index]!,
		});
	}
	values.sort((left, right) => left.id - right.id);

	const id = releaseKey(geography, release);
	const resource = context.mapResources?.resources.find(
		(entry) => entry.id === id,
	);
	const join = {
		boundaryRelease: { geography, release },
		...(resource ? { layer: resource.tiles.layer } : {}),
		method: "code-or-name-match",
		summary: {
			rows: rows.areas.length,
			joined: values.length,
			unjoined: unjoined.length,
			duplicateAreas: [...rowsByCode.values()].filter(
				(indexes) => indexes.length > 1,
			).length,
			areasWithoutValue: areaCodes.length - values.length,
		},
		note: "Each row is read as in areas:validate: a code must be in this release, and a name must mean exactly one of its areas. Rows that do not are listed in unjoined with the reason, as is every row for an area given more than one value. Values are passed through as sent; nothing is converted, and nothing is stored.",
		...(resource
			? {
					links: {
						mapResource: `/v1/map-resources/${id}`,
						tiles: `/v1/map-resources/${id}/tiles.json`,
						attribution: resource.attribution.href,
					},
				}
			: {}),
	};
	if (format === "json")
		return {
			status: 200,
			body: envelope(releaseId, { ...join, values, unjoined }),
		};

	const entry = resource?.features.find(
		(candidate) =>
			candidate.tier === tier && candidate.format === "geojson",
	);
	const stored = entry && context.mapFeatures?.get(entry.artifact);
	if (!resource || !entry || !stored)
		return problem(
			503,
			"Catalogue Unavailable",
			`No GeoJSON is built for ${id} at tier ${tier}; the join table, without format=geojson, still numbers the values for its tiles.`,
		);
	if (stored.bytes > MAX_GEOJSON_JOIN_BYTES)
		return problem(
			422,
			"Too Large To Join As GeoJSON",
			`${id} at tier ${tier} is ${Math.round(stored.bytes / 1048576)} MB of GeoJSON, more than the ${MAX_GEOJSON_JOIN_BYTES / 1048576} MB read for one request. Ask for a coarser tier, or take the join table and draw it on ${join.links!.tiles}.`,
			{ links: { tiles: join.links!.tiles } },
		);
	const raw = readFileSync(stored.path);
	const collection = JSON.parse(
		(stored.gzipBytes !== undefined ? gunzipSync(raw) : raw).toString(
			"utf8",
		),
	) as {
		features: Array<{
			id: number;
			properties: Record<string, unknown>;
			geometry: unknown;
		}>;
	};
	const valueById = new Map(values.map((row) => [row.id, row.value]));
	const features = collection.features
		.filter((feature) => valueById.has(feature.id))
		.map((feature) => ({
			...feature,
			properties: {
				...feature.properties,
				value: valueById.get(feature.id),
			},
		}));
	const geoJson = {
		type: "FeatureCollection",
		name: id,
		tier,
		attribution: resource.attribution.text,
		atlasRelease: releaseId,
		join: { ...join, unjoined },
		features,
	};
	return {
		status: 200,
		body: envelope(releaseId, { ...join, unjoined }),
		representation: {
			contentType: "application/geo+json",
			body: `${JSON.stringify(geoJson)}\n`,
			headers: {
				"content-disposition": `attachment; filename="${geography}-${release}-joined.geojson"`,
			},
		},
	};
};
