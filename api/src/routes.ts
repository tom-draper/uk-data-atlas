import type { AreaLookup } from "./areaInventory";
import { explainAreaAbsence } from "./areaAbsence";
import { selectReleaseForDate } from "./releaseForDate";
import {
	MAX_BATCH_VALUES,
	summariseBatch,
	validateBatch,
} from "./batchValidation";
import type { AreaGeometryCache } from "./areaGeometry";
import { areaMetrics } from "./areaMetrics";
import {
	GEOMETRY_TIERS,
	isGeometryTier,
	simplifyGeometry,
} from "./simplifyGeometry";
import {
	createAreaRelationshipIndex,
	type AreaRelationshipIndex,
} from "./areaRelationships";
import type { BoundaryRegistry } from "./boundaryRegistry";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "./crosswalkInventory";
import type { NamedLocationInventory } from "./namedLocations";
import {
	areaIdentityTable,
	crosswalkTable,
	type LookupFormat,
	lookupBodyHash,
	namedLocationMembersTable,
	renderLookup,
} from "./lookupExports";
import {
	type DataCatalog,
	findMeasureObservations,
	isNumericObservation,
	isLegacyPopulationSource,
	type AnyMeasureObservationArtifact,
	type MeasureObservation,
	type MeasureSource,
	observationArtifactName,
	type PopulationObservation,
	type PopulationLocalAuthorityObservationArtifact,
	type PopulationObservationArtifact,
} from "./dataCatalog";
import { compareObservations } from "./comparison";
import {
	aggregateCountryMembers,
	aggregateLocationMembers,
	isCountryCode,
	assessCoverage,
	countryCodeFor,
	summariseCoverage,
} from "./aggregation";
import { convertObservations } from "./conversion";
import { measurePairOverlap, PAIR_OVERLAP_RULES } from "./areaOverlap";
import { attributionFor, attributionText } from "./attribution";
import { measureCoverage } from "./measureCoverage";
import {
	reconcileMembers,
	reconcileMembersForYear,
} from "./memberReconciliation";
import {
	crosswalksTo,
	membersThroughCrosswalk,
	membershipKindFor,
} from "./locationMembership";
import { rankObservations, type RankingOrder } from "./ranking";
import {
	createPlaceIndex,
	resolvePlaces,
	type PlaceCandidate,
	type PlaceIndex,
} from "./placeResolver";
import { valueForPlace, type Attempt } from "./placeValue";
import {
	changeRefusal,
	changeValue,
	computeChanges,
	periodsOverlap,
	relativeChangeRefusal,
	type ChangeBasis,
} from "./change";
import {
	exportMeasureRecords,
	type MeasureExportRecord,
	type TabularFormat,
} from "./tabularExport";
import {
	sourceExactProvenance,
	sourceSeriesProvenance,
	type CallerSelectedGeometry,
	type ObservationArtifactReference,
} from "./sourceExactProvenance";
import { handleRoute } from "./routeHandlers";
import type {
	AreaSearchIndex,
	AreaSearchResult,
	CrosswalkLookup,
	RouteContext,
} from "./routing";
import { envelope, problem, type ApiResponse } from "./routeResponse";

export { type ApiResponse } from "./routeResponse";

/**
 * Travels with every measurement, so a figure taken from one response can be
 * read without the documentation beside it. The last line is the one that
 * matters: this is the boundary as published, not a land-area statistic.
 */
const AREA_METRIC_METHOD = {
	area: "Ellipsoidal, through EPSG:6933 (WGS 84 / NSIDC EASE-Grid 2.0 Global), a Lambert cylindrical equal-area projection on the WGS 84 ellipsoid. Projected area equals area on the ellipsoid, so no correction is applied. Holes are subtracted.",
	perimeter:
		"Summed over every ring, holes included. Each edge's ground length comes from the ellipsoid's meridional and prime-vertical radii of curvature at its mid-latitude.",
	centroid:
		"The centre of area, taken in the same equal-area projection so each part weighs its true ground area, then inverted to WGS 84. It can fall outside a crescent or a split area.",
	labelPoint:
		"A point guaranteed inside the area. The centroid where that lies within the geometry, otherwise the midpoint of the widest run of interior found on latitudes sampled across the bounding box.",
	caveat: "Measured from the boundary as that release publishes it, at its own generalisation. This is not a published land-area statistic: a coastline-clipped boundary still encloses inland water, so these figures differ from the ONS Standard Area Measurement used by population density.",
} as const;

/**
 * Sent with any geometry that was generalised, so the drawing a caller holds
 * carries the terms it was made on. The second half is the one that bites:
 * areas are simplified one at a time, so two neighbours drawn together at the
 * same tier need not agree along the border they share.
 */
const GENERALISATION_METHOD = {
	rule: "Visvalingam-Whyatt. The vertex whose triangle with its two neighbours is smallest is dropped, repeatedly, until the smallest remaining triangle exceeds the tier's threshold. Triangles are measured in the EPSG:6933 equal-area projection, so the threshold is real square metres anywhere in the country.",
	threshold:
		"A tier is the side of the smallest square of detail kept, and its threshold is that square's area. It bounds the size of feature dropped. It is not a promise that no vertex moves further than the tolerance: the same deviation spans a larger triangle the further apart its neighbours are.",
	parts: "A part or hole whose own area falls below the threshold is dropped whole, rather than surviving as a triangle. An area keeps its geometry type, so a MultiPolygon reduced to one part is still a MultiPolygon.",
	sharedBorders:
		"Each area is generalised alone, from its own vertices. Above the full tier, neighbours drawn together may disagree along a shared border. Ask for the full tier where borders must meet exactly.",
} as const;

/**
 * A box query answers with identities by default, so the cost of a wide box is
 * bounded whether or not the caller asks for coordinates too. The cap is on
 * results rather than on the box: a national box is a reasonable analysis
 * question, and it is the geometry that is expensive, not the extent.
 */
/**
 * Travels with a neighbour list, because the answer rests on a property of the
 * published release rather than on a distance anyone chose.
 */
const PAIR_OVERLAP_METHOD = {
	...PAIR_OVERLAP_RULES,
	rule: "The two geometries are intersected and the intersection judged by its widest piece, as the published area-overlap crosswalks are compiled. Under sliverWidthM it is where two independently generalised borders disagree, and the relation is boundary-only; within a factor of two of it the relation is indeterminate, because a crosswalk compile would refuse to decide. Otherwise an area is within the other once minimumCoverage of it is covered.",
	area: "Ellipsoidal, through EPSG:6933, an equal-area projection on the WGS 84 ellipsoid, so no correction is applied. A piece's width is twice its area over its perimeter.",
	limits: "Computed from the generalised boundaries as published, which trace coastlines and borders approximately. This measures those shapes and is not an official statement of how the two areas relate; publishedRelationships lists any crosswalk that is.",
} as const;

const NEIGHBOUR_METHOD = {
	rule: "Two areas are neighbours where their boundaries share vertices. Adjacent areas in one release are drawn from the same vertices, so a shared border is the same coordinates on both sides and matches exactly. No distance threshold decides who is a neighbour.",
	sharedBorder:
		"Summed over the edges the two areas have in common, each counted once, with ground length from the ellipsoid's radii of curvature at the edge's mid-latitude.",
	unshared:
		"Perimeter less the border shared with the neighbours returned. For a landlocked area this is nothing; otherwise it is coastline, a national boundary, or a border with an area outside this release.",
	limits: "Within one geography and release only. Two areas that genuinely touch on the ground but were drawn from different vertices are not found, which is why this is not offered across releases.",
} as const;

/** The geography a curated location's member codes are written in. */
const MEMBER_GEOGRAPHY = "localAuthority";

const DEFAULT_INTERSECTS_LIMIT = 200;
const MAX_INTERSECTS_LIMIT = 1000;

const decodePathSegment = (segment: string) => {
	try {
		return decodeURIComponent(segment);
	} catch {
		return undefined;
	}
};

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

/**
 * The published observations behind one measure source, whichever artifact
 * holds them.
 *
 * The ward population artifact predates the per-period shape and carries a
 * single period at its top level, so it is adapted here rather than reshaped
 * on disk, which would change a published file.
 */
const observationsFor = (
	measureId: string,
	source: MeasureSource,
	period: string,
	artifacts: {
		populationObservations?: PopulationObservationArtifact;
		populationLocalAuthorityObservations?: PopulationLocalAuthorityObservationArtifact;
		measureObservations?: AnyMeasureObservationArtifact[];
	},
):
	| (ObservationArtifactReference & { records: MeasureObservation[] })
	| undefined => {
	if (isLegacyPopulationSource(measureId, source)) {
		if (source.sourceGeography.type === "ward") {
			const artifact = artifacts.populationObservations;
			return artifact && artifact.period === period
				? {
						artifact: "population-observations",
						contentHash: artifact.contentHash,
						records: artifact.records,
					}
				: undefined;
		}
		const artifact = artifacts.populationLocalAuthorityObservations;
		const records = artifact?.periods.find(
			(candidate) => candidate.period === period,
		)?.records;
		return artifact && records
			? {
					artifact: "population-local-authority-observations",
					contentHash: artifact.contentHash,
					records,
				}
			: undefined;
	}
	const artifact = findMeasureObservations(
		artifacts.measureObservations ?? [],
		measureId,
		source,
	);
	const records = artifact?.periods.find(
		(candidate) => candidate.period === period,
	)?.records;
	return artifact && records
		? {
				artifact: observationArtifactName(measureId, source),
				contentHash: artifact.contentHash,
				records,
			}
		: undefined;
};

/**
 * The canonical identity of a country code, from the newest compiled country
 * release. Countries are stable across releases, so the newest is a safe
 * choice, and the release is reported alongside the name.
 */
const findCountryIdentity = (
	areaLookup: AreaLookup | undefined,
	code: string,
) => {
	const releases = [...(areaLookup?.keys() ?? [])]
		.filter((key) => key.startsWith("country/"))
		.sort()
		.reverse();
	for (const key of releases) {
		const area = areaLookup?.get(key)?.get(code);
		if (area) {
			const boundaryRelease = key.slice("country/".length);
			return {
				id: `country/${boundaryRelease}/${code}`,
				boundaryRelease,
				...area,
			};
		}
	}
	return undefined;
};

/**
 * An area-overlap crosswalk is safe for direct regional membership only when
 * every selected source area is wholly covered by exactly that one region.
 * Split or partial overlaps remain conversion data and are never silently
 * treated as a regional sum.
 */
const fullRegionMembership = (
	crosswalk: CrosswalkArtifact,
	regionCode: string,
) => {
	if (crosswalk.method !== "area-overlap") return undefined;
	const matching = crosswalk.records.filter((record) =>
		record.targets.some((target) => target.code === regionCode),
	);
	const memberCodes = matching.flatMap((record) => {
		const target = record.targets.find(
			(candidate) => candidate.code === regionCode,
		);
		return target &&
			record.targets.length === 1 &&
			record.source.coverage === 1 &&
			target.sourceShare === 1
			? [record.source.code]
			: [];
	});
	return {
		memberCodes,
		unsafeSourceCount: matching.length - memberCodes.length,
	};
};

/** How a non-aggregatable statistic reads in a sentence. */
const statisticPhrase = (statistic: string) =>
	({
		median: "a median",
		rank: "a rank",
		decile: "a decile",
		"life-expectancy": "a life expectancy",
	})[statistic] ?? `a ${statistic}`;

/** The same query with the cursor advanced, as a relative `Link` target. */
const nextPageHref = (parsedUrl: URL, nextCursor: string) => {
	const params = new URLSearchParams(parsedUrl.searchParams);
	params.set("cursor", nextCursor);
	return `${parsedUrl.pathname}?${params.toString()}`;
};

const readPageSize = (value: string | null): number | undefined => {
	if (value === null) return DEFAULT_PAGE_SIZE;
	if (!/^[1-9]\d*$/.test(value)) return undefined;
	const size = Number(value);
	return size <= MAX_PAGE_SIZE ? size : undefined;
};

const readRankingOrder = (value: string | null): RankingOrder | undefined =>
	value === null || value === "desc"
		? "desc"
		: value === "asc"
			? "asc"
			: undefined;

const readCoordinate = (
	value: string | null,
	minimum: number,
	maximum: number,
): number | undefined => {
	if (value === null || value.trim().length === 0) return undefined;
	const coordinate = Number(value);
	return Number.isFinite(coordinate) &&
		coordinate >= minimum &&
		coordinate <= maximum
		? coordinate
		: undefined;
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

const findArea = (
	areaLookup: AreaLookup | undefined,
	geography: string,
	boundaryRelease: string,
	code: string,
) => areaLookup?.get(`${geography}/${boundaryRelease}`)?.get(code);

/**
 * The source partitions of a measure assessed against one boundary release,
 * each period saying whether its artifact holds a value for the area. Only a
 * partition whose code set was assessed against this exact release is listed;
 * the assessment compares codes and does not assert equal geometry.
 */
const areaMeasureSources = (
	measure: DataCatalog["measures"][number],
	coverage: ReturnType<typeof measureCoverage>,
	boundaryRelease: string,
	code: string,
	artifacts: Parameters<typeof observationsFor>[3],
) =>
	coverage?.sources.flatMap((coveredSource, index) => {
		const boundaryCoverage = coveredSource.boundaryCoverage.find(
			(candidate) => candidate.boundaryRelease === boundaryRelease,
		);
		const source = measure.sources[index];
		if (!boundaryCoverage || !source) return [];
		return [
			{
				dataset: coveredSource.dataset,
				sourceGeography: coveredSource.sourceGeography,
				codeSetCompatibility: boundaryCoverage,
				periods: source.periods.map((period) => {
					const observations = observationsFor(
						measure.id,
						source,
						period,
						artifacts,
					);
					const record = observations?.records.find(
						(candidate) => candidate.areaCode === code,
					);
					return observations
						? {
								period,
								artifact: observations.artifact,
								contentHash: observations.contentHash,
								availability: record
									? ("present" as const)
									: ("absent" as const),
								...(record
									? { status: record.status ?? "unknown" }
									: {}),
							}
						: { period, availability: "not-published" as const };
				}),
			},
		];
	}) ?? [];

const relationshipsFor = (
	areaRelationshipIndex: AreaRelationshipIndex | undefined,
	crosswalkLookup: CrosswalkLookup | undefined,
	geography: string,
	boundaryRelease: string,
	code: string,
) =>
	(
		areaRelationshipIndex ??
		(crosswalkLookup
			? createAreaRelationshipIndex(crosswalkLookup.values())
			: undefined)
	)?.get(`${geography}/${boundaryRelease}/${code}`) ?? [];

/**
 * Route a request against named, independently-built catalogues. Keeping the
 * dependencies in one object prevents a newly added artifact from silently
 * shifting a long positional argument list at every call site.
 */
/*
 * The place index is built from the whole compiled area inventory, some eighty
 * thousand places, which takes the better part of a second. It is built on the
 * first request that needs it and kept for as long as that inventory is.
 */
const placeIndexes = new WeakMap<
	object,
	{ locations: unknown; index: PlaceIndex }
>();

const placeIndexFor = (
	areaLookup: AreaLookup,
	namedLocationInventory: NamedLocationInventory | undefined,
) => {
	const cached = placeIndexes.get(areaLookup);
	if (cached && cached.locations === namedLocationInventory) {
		return cached.index;
	}
	const index = createPlaceIndex(areaLookup, namedLocationInventory);
	placeIndexes.set(areaLookup, { locations: namedLocationInventory, index });
	return index;
};

const describeCandidate = (candidate: PlaceCandidate) => ({
	place: candidate.place,
	kind: candidate.kind,
	name: candidate.name,
	geography: candidate.geography,
	code: candidate.code,
	match: candidate.match,
	...(candidate.matchedLabel !== candidate.name
		? { matchedLabel: candidate.matchedLabel }
		: {}),
});

const describeAttempt = (attempt: Attempt) =>
	attempt.served
		? {
				...describeCandidate(attempt.candidate),
				served: true,
				method: attempt.method,
				answer: attempt.answer,
				via: attempt.via,
			}
		: {
				...describeCandidate(attempt.candidate),
				served: false,
				reason: attempt.reason,
			};

export const route = (
	method: string | undefined,
	url: string | undefined,
	context: RouteContext,
): ApiResponse => {
	const {
		boundaryRegistry: registry,
		geographyInventory,
		areaInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
		atlasRelease,
		areaSearchIndex,
		areaRelationshipIndex,
		areaGeometryCache,
		relationshipCandidateInventory,
		validationReport,
		namedLocationInventory,
		namedLocationLookup,
		dataCatalog,
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
		measureCompatibilityInventory,
		exportManifest,
		lookupManifest,
	} = context;
	const releaseId = atlasRelease?.releaseId ?? registry.contentHash;
	if (method !== "GET") {
		return problem(405, "Method Not Allowed", "This API is read-only.");
	}

	/**
	 * A 404 for an area identity that says why it resolves to nothing: an
	 * unpublished geography or release, identities not compiled, or a code the
	 * release does not hold, with the releases that do.
	 */
	const areaNotFound = (
		geography: string | undefined,
		boundaryRelease: string | undefined,
		code: string | undefined,
	): ApiResponse => {
		const { detail, ...absence } = explainAreaAbsence(
			registry,
			areaInventory,
			areaLookup,
			geography ?? "",
			boundaryRelease ?? "",
			code ?? "",
		);
		return problem(404, "Not Found", detail, absence);
	};

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
	const handledResponse = handleRoute({
		context,
		releaseId,
		parsedUrl,
		segments: segments as string[],
	});
	if (handledResponse) return handledResponse;

	if (segments.length === 1 && segments[0] === "v1") {
		return {
			status: 200,
			body: envelope(releaseId, {
				name: "UK Data Atlas API",
				links: [
					"/v1/geographies",
					"/v1/boundary-releases",
					"/v1/boundary-releases:resolve",
					"/v1/boundary-releases/{type}/{release}",
					"/v1/geography-inventory",
					"/v1/datasets",
					"/v1/datasets/{dataset-id}",
					"/v1/measures",
					"/v1/measures/{measure-id}",
					"/v1/measures/{measure-id}/compatibility",
					"/v1/measures/{measure-id}/coverage",
					"/v1/measures/{measure-id}/quality",
					"/v1/data/{measure-id}",
					"/v1/data/{measure-id}/series",
					"/v1/data/{measure-id}/rankings",
					"/v1/data/{measure-id}/change",
					"/v1/data/{measure-id}/value",
					"/v1/places",
					"/v1/data/{measure-id}/compare",
					"/v1/data/{measure-id}/aggregate",
					"/v1/data/{measure-id}/convert",
					"/v1/areas",
					"/v1/areas:contains",
					"/v1/areas:intersects",
					"/v1/areas:validate",
					"/v1/areas/{type}/{release}/{code}",
					"/v1/areas/{type}/{release}/{code}/history",
					"/v1/areas/{type}/{release}/{code}/parents",
					"/v1/areas/{type}/{release}/{code}/children",
					"/v1/areas/{type}/{release}/{code}/children/geometry",
					"/v1/areas/{type}/{release}/{code}/relationships",
					"/v1/areas/{type}/{release}/{code}/neighbours",
					"/v1/areas/{type}/{release}/{code}/overlap",
					"/v1/areas/{type}/{release}/{code}/capabilities",
					"/v1/areas/{type}/{release}/{code}/citation",
					"/v1/areas/{type}/{release}/{code}/geometry",
					"/v1/areas/{type}/{release}/{code}/geometry/metadata",
					"/v1/translations",
					"/v1/attribution",
					"/v1/locations",
					"/v1/locations/{location-id}",
					"/v1/locations/{location-id}/members",
					"/v1/crosswalks",
					"/v1/crosswalks/{crosswalk-id}",
					"/v1/crosswalks/{crosswalk-id}/records",
					"/v1/relationship-candidates",
					"/v1/validation",
					"/v1/validation/boundary-releases/{type}/{release}",
					"/v1/validation/crosswalks/{crosswalk-id}",
					"/v1/validation/measures/{measure-id}",
					"/v1/validation/exports/{export-id}",
					"/v1/exports",
					"/v1/exports/{export-id}",
					"/v1/lookups",
					"/v1/lookups/{lookup-id}",
					"/v1/atlas-release",
					"/v1/atlas-releases",
					"/v1/atlas-releases/{release-id}",
					"/v1/atlas-releases/compare",
				],
			}),
		};
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "datasets"
	) {
		return dataCatalog
			? { status: 200, body: envelope(releaseId, dataCatalog.datasets) }
			: problem(
					503,
					"Catalogue Unavailable",
					"Build the data catalogue before listing datasets.",
				);
	}

	if (
		segments.length === 3 &&
		segments[0] === "v1" &&
		segments[1] === "datasets"
	) {
		if (!dataCatalog) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the data catalogue before retrieving datasets.",
			);
		}
		const dataset = dataCatalog.datasets.find(
			(candidate) => candidate.id === segments[2],
		);
		return dataset
			? { status: 200, body: envelope(releaseId, dataset) }
			: problem(
					404,
					"Not Found",
					"No published dataset matches that id.",
				);
	}

	if (
		segments.length === 4 &&
		segments[0] === "v1" &&
		segments[1] === "measures" &&
		segments[3] === "quality"
	) {
		if (!dataCatalog || !measureCompatibilityInventory) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the data catalogue and measure compatibility before retrieving measure quality.",
			);
		}
		const measure = dataCatalog.measures.find(
			(candidate) => candidate.id === segments[2],
		);
		const coverage = measureCoverage(
			dataCatalog,
			measureCompatibilityInventory,
			segments[2] as string,
		);
		if (!measure || !coverage) {
			return problem(
				404,
				"Not Found",
				"No published measure quality record matches that id.",
			);
		}
		return {
			status: 200,
			body: envelope(releaseId, {
				measure: {
					id: measure.id,
					valueKind: measure.valueKind,
					unit: measure.unit,
					aggregation: measure.aggregation,
					availability: measure.availability,
				},
				sources: measure.sources.map((source, index) => ({
					datasetId: source.datasetId,
					sourceGeography: source.sourceGeography,
					sourceCoverage: source.coverage,
					boundaryCoverage:
						coverage.sources[index]?.boundaryCoverage ?? [],
					periods: source.periods.map((period) => {
						const observations = observationsFor(
							measure.id,
							source,
							period,
							{
								populationObservations,
								populationLocalAuthorityObservations,
								measureObservations,
							},
						);
						const statusCounts = observations?.records.reduce(
							(counts, record) => {
								const status = record.status ?? "unknown";
								counts[status] = (counts[status] ?? 0) + 1;
								return counts;
							},
							{} as Record<string, number>,
						);
						return observations
							? {
									period,
									artifact: observations.artifact,
									contentHash: observations.contentHash,
									recordCount: observations.records.length,
									statusCounts,
								}
							: { period, status: "not-published" as const };
					}),
				})),
				note: "Boundary coverage is code-set compatibility only. Status counts describe source observation records and do not impute missing areas.",
			}),
		};
	}

	if (
		segments.length === 4 &&
		segments[0] === "v1" &&
		segments[1] === "data" &&
		segments[3] === "aggregate"
	) {
		if (!dataCatalog) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the data catalogue before aggregating observations.",
			);
		}
		const measureId = segments[2] as string;
		const measure = dataCatalog.measures.find(
			(candidate) => candidate.id === measureId,
		);
		if (!measure)
			return problem(
				404,
				"Not Found",
				"No published measure serves aggregation at that path.",
			);
		const weightedAggregation =
			measure.aggregation.kind === "intensive" &&
			measure.aggregation.operation === "weighted-mean" &&
			measure.aggregation.available
				? measure.aggregation
				: undefined;
		const usesWeightedMean = weightedAggregation !== undefined;
		const usesSum =
			measure.aggregation.kind === "extensive" &&
			measure.aggregation.available;
		if (!usesSum && !usesWeightedMean) {
			return problem(
				422,
				"Operation Not Supported",
				measure.aggregation.kind === "non-aggregatable"
					? `This measure is ${statisticPhrase(measure.aggregation.statistic)} and cannot be combined over areas. ${measure.aggregation.note}`
					: "This measure is not available for aggregation.",
				{ code: "aggregation_not_supported" },
			);
		}
		if (
			parsedUrl.searchParams.has("release") ||
			parsedUrl.searchParams.has("conversion")
		) {
			return problem(
				422,
				"Operation Not Supported",
				"This aggregation does not select a geometry release or convert observations.",
			);
		}
		const period = parsedUrl.searchParams.get("period");
		const geography = parsedUrl.searchParams.get("geography");
		const boundaryYear = parsedUrl.searchParams.get("boundaryYear");
		const locationId = parsedUrl.searchParams.get("locationId");
		const areaCode = parsedUrl.searchParams.get("areaCode");
		const regionCode = parsedUrl.searchParams.get("regionCode");
		if ([locationId, areaCode, regionCode].filter(Boolean).length !== 1) {
			return problem(
				400,
				"Invalid Query",
				"Supply exactly one of locationId, for a curated named location, areaCode, for a country, or regionCode with a regional crosswalk.",
			);
		}
		if (areaCode && !isCountryCode(areaCode)) {
			return problem(
				400,
				"Invalid Query",
				"areaCode currently supports a country code only, such as E92000001. Use locationId for a curated named location.",
			);
		}
		if (locationId && !namedLocationLookup) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the named location inventory before aggregating over a location.",
			);
		}
		const location = locationId
			? namedLocationLookup?.get(locationId)
			: undefined;
		if (locationId && !location)
			return problem(
				404,
				"Not Found",
				"No named location matches locationId.",
			);
		const source = measure.sources.find(
			(candidate) =>
				candidate.periods.includes(period ?? "") &&
				candidate.sourceGeography.type === geography &&
				String(candidate.sourceGeography.boundaryYear) === boundaryYear,
		);
		if (!source)
			return problem(
				400,
				"Invalid Query",
				`${measureId} has no published source for that period, geography and boundary year.`,
			);
		// The boundary releases this partition is assessed to match, against
		// which an aggregate's coverage can be judged.
		const compatibleReleases = (
			measureCompatibilityInventory?.measures
				.find((candidate) => candidate.measureId === measureId)
				?.sources.find(
					(candidate) =>
						candidate.datasetId === source.datasetId &&
						candidate.sourceGeography.type ===
							source.sourceGeography.type &&
						candidate.sourceGeography.boundaryYear ===
							source.sourceGeography.boundaryYear &&
						candidate.periods.includes(period as string),
				)?.candidates ?? []
		).filter(
			(candidate) =>
				candidate.status === "exact-code-set" ||
				candidate.status === "code-set-compatible",
		);
		const regional = (() => {
			if (!regionCode) return undefined;
			const crosswalkId = parsedUrl.searchParams.get("crosswalk");
			const sourceRelease = parsedUrl.searchParams.get("sourceRelease");
			if (!crosswalkId || !sourceRelease) {
				return problem(
					400,
					"Invalid Query",
					"regionCode aggregation requires crosswalk and sourceRelease, so regional membership is explicit rather than inferred.",
				);
			}
			if (!crosswalkLookup || !measureCompatibilityInventory) {
				return problem(
					503,
					"Catalogue Unavailable",
					"Build crosswalk and measure compatibility inventories before aggregating a region.",
				);
			}
			const compatibility = compatibleReleases.find(
				(candidate) => candidate.boundaryRelease === sourceRelease,
			);
			if (!compatibility) {
				return problem(
					422,
					"Operation Not Supported",
					"The requested sourceRelease is not code-set compatible with this source partition.",
					{ code: "conversion_not_available" },
				);
			}
			const crosswalk = crosswalkLookup.get(crosswalkId);
			if (
				!crosswalk ||
				crosswalk.from.geography !== source.sourceGeography.type ||
				crosswalk.from.boundaryRelease !== sourceRelease ||
				crosswalk.to.geography !== "region"
			) {
				return problem(
					422,
					"Operation Not Supported",
					"That crosswalk does not map the caller-selected compatible source release to regions.",
					{ code: "conversion_not_available" },
				);
			}
			const membership = fullRegionMembership(crosswalk, regionCode);
			if (!membership || membership.unsafeSourceCount > 0) {
				return problem(
					422,
					"Operation Not Supported",
					"The selected region is not represented by complete one-to-one source-area membership in that crosswalk.",
					{ code: "conversion_not_available" },
				);
			}
			return {
				crosswalk,
				sourceRelease,
				memberCodes: new Set(membership.memberCodes),
				region: {
					id: `region/${crosswalk.to.boundaryRelease}/${regionCode}`,
					boundaryRelease: crosswalk.to.boundaryRelease,
					code: regionCode,
					...findArea(
						areaLookup,
						"region",
						crosswalk.to.boundaryRelease,
						regionCode,
					),
				},
			};
		})();
		if (regional && "status" in regional) return regional;
		const observations = observationsFor(
			measureId,
			source,
			period as string,
			{
				populationObservations,
				populationLocalAuthorityObservations,
				measureObservations,
			},
		);
		if (!observations)
			return problem(
				503,
				"Catalogue Unavailable",
				`The observation artifact for ${measureId} is missing, or does not contain the catalogue's declared source period.`,
			);
		const numericRecords =
			observations.records.filter(isNumericObservation);
		if (numericRecords.length !== observations.records.length) {
			return problem(
				503,
				"Catalogue Unavailable",
				`The observation artifact for ${measureId} does not contain numeric records required for aggregation.`,
			);
		}
		const byLocation = location
			? aggregateLocationMembers(location, numericRecords)
			: undefined;
		/*
		 * A curated location lists every code it has ever been made of, so
		 * against any one partition some are always the wrong vintage: the
		 * North West carries the six Cumbria districts and the two unitaries
		 * that replaced them, and no release holds both. Refusing on any
		 * unresolved code refused the location outright, for every vintage.
		 *
		 * What must hold is that nothing is missed and nothing counted twice.
		 * A code absent because it is superseded has its successor resolving in
		 * its place, and one not yet current has its predecessor; either way
		 * the ground is covered exactly once, because a release's areas are a
		 * partition and only codes in that release are summed. An absence the
		 * vintage does not explain is still refused.
		 */
		const locationCoverage =
			location && byLocation && areaLookup
				? reconcileMembersForYear(
						areaLookup,
						source.sourceGeography.type,
						source.sourceGeography.boundaryYear,
						location.memberCodes,
						new Set(
							byLocation.members.map((record) => record.areaCode),
						),
					)
				: undefined;
		// Telling a vintage mismatch from a bad code needs the compiled releases
		// to compare against. Without them, fall back to refusing any unresolved
		// code rather than guessing which kind it is.
		if (
			location &&
			byLocation &&
			!areaLookup &&
			byLocation.unresolvedMemberCodes.length > 0
		) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the area inventory before aggregating over a named location, so a member code of another vintage can be told from one that is wrong.",
			);
		}
		if (locationCoverage && !locationCoverage.coversLocation) {
			return problem(
				422,
				"Operation Not Supported",
				`The named location does not cover this source partition by direct code match: ${locationCoverage.unexplained
					.map((member) => `${member.code} (${member.status})`)
					.join(", ")}. No conversion or partial sum was applied.`,
				{ code: "partial_coverage" },
			);
		}
		if (byLocation && location && byLocation.members.length === 0) {
			// A country is carried as a map extent with no member codes, and is
			// summed by its own GSS code rather than by membership.
			if (location.memberCodes.length === 0) {
				return problem(
					422,
					"Operation Not Supported",
					`${location.label} carries no member codes: it names an extent rather than a set of areas. Aggregate a country with areaCode, such as areaCode=E92000001 for England.`,
				);
			}
			const resolvedElsewhere = [
				...new Set(
					(locationCoverage?.unresolved ?? []).flatMap(
						(member) => member.presentIn,
					),
				),
			].sort();
			return problem(
				422,
				"Operation Not Supported",
				`Every member code of ${location.label} is the wrong vintage for this source partition, which is on ${source.sourceGeography.boundaryYear} ${source.sourceGeography.type} codes${
					resolvedElsewhere.length > 0
						? `; they resolve against ${resolvedElsewhere.join(", ")}`
						: ""
				}. The place is no longer one of these areas in its own right.`,
			);
		}
		const byCountry =
			location || regional
				? undefined
				: aggregateCountryMembers(areaCode as string, numericRecords);
		const byRegion = regional
			? {
					members: numericRecords.filter((record) =>
						regional.memberCodes.has(record.areaCode),
					),
					value: numericRecords
						.filter((record) =>
							regional.memberCodes.has(record.areaCode),
						)
						.reduce((total, record) => total + record.value, 0),
				}
			: undefined;
		// A country the partition does not reach would otherwise sum to zero,
		// which reads as an observation rather than an absence.
		if (byCountry && byCountry.members.length === 0) {
			return problem(
				422,
				"Operation Not Supported",
				"This source partition publishes no areas for that country, so there is nothing to sum.",
			);
		}
		if (byRegion && byRegion.members.length === 0) {
			return problem(
				422,
				"Operation Not Supported",
				"This source partition publishes no areas for that region, so there is nothing to combine.",
			);
		}
		/*
		 * A country or region total sums whatever the partition publishes, so a
		 * partition holding values for only some areas, as a local election
		 * does for the wards that went to the polls, still answers. It must
		 * then say so, by comparing what was summed with the areas a matching
		 * boundary release holds. A named location is not assessed here: its
		 * members are reconciled above, and an unexplained gap is refused.
		 */
		const coverage = byCountry
			? summariseCoverage(
					compatibleReleases.flatMap((candidate) => {
						const expected = [
							...(areaLookup
								?.get(
									`${source.sourceGeography.type}/${candidate.boundaryRelease}`,
								)
								?.keys() ?? []),
						].filter((code) => countryCodeFor(code) === areaCode);
						return expected.length > 0
							? [
									assessCoverage(
										candidate.boundaryRelease,
										expected,
										new Set(
											byCountry.members.map(
												(record) => record.areaCode,
											),
										),
									),
								]
							: [];
					}),
					"No compiled boundary release is assessed as a matching code set for this source partition, so the areas it should hold for this country are not known.",
				)
			: byRegion && regional
				? summariseCoverage(
						[
							assessCoverage(
								regional.sourceRelease,
								regional.memberCodes,
								new Set(
									byRegion.members.map(
										(record) => record.areaCode,
									),
								),
							),
						],
						"",
					)
				: undefined;
		const aggregate = byLocation ?? byCountry ?? byRegion;
		if (!aggregate)
			return problem(
				400,
				"Invalid Query",
				"Supply exactly one of locationId, areaCode or regionCode.",
			);
		let aggregateValue = aggregate.value;
		let weighting:
			| {
					measure: (typeof dataCatalog.measures)[number];
					source: MeasureSource;
					observations: ObservationArtifactReference;
					total: number;
			  }
			| undefined;
		if (weightedAggregation) {
			const weightMeasureId = weightedAggregation.weight.measureId;
			if (!weightMeasureId) {
				return problem(
					422,
					"Operation Not Supported",
					"This weighted measure does not publish a weight measure the API can aggregate with.",
					{ code: "aggregation_not_supported" },
				);
			}
			const weightMeasure = dataCatalog.measures.find(
				(candidate) => candidate.id === weightMeasureId,
			);
			const weightSource = weightMeasure?.sources.find(
				(candidate) =>
					candidate.periods.includes(period ?? "") &&
					candidate.sourceGeography.type ===
						source.sourceGeography.type &&
					candidate.sourceGeography.boundaryYear ===
						source.sourceGeography.boundaryYear,
			);
			if (!weightMeasure || !weightSource) {
				return problem(
					503,
					"Catalogue Unavailable",
					`No source-exact ${weightMeasureId} partition is available to weight ${measureId}.`,
				);
			}
			const weightObservations = observationsFor(
				weightMeasureId,
				weightSource,
				period as string,
				{
					populationObservations,
					populationLocalAuthorityObservations,
					measureObservations,
				},
			);
			if (!weightObservations) {
				return problem(
					503,
					"Catalogue Unavailable",
					`The weight artifact for ${weightMeasureId} is missing, or does not contain the catalogue's declared source period.`,
				);
			}
			const weightRecords =
				weightObservations.records.filter(isNumericObservation);
			if (weightRecords.length !== weightObservations.records.length) {
				return problem(
					503,
					"Catalogue Unavailable",
					`The weight artifact for ${weightMeasureId} does not contain numeric records.`,
				);
			}
			const weightAggregate = location
				? aggregateLocationMembers(location, weightRecords)
				: regional
					? {
							members: weightRecords.filter((record) =>
								regional.memberCodes.has(record.areaCode),
							),
							value: weightRecords
								.filter((record) =>
									regional.memberCodes.has(record.areaCode),
								)
								.reduce(
									(total, record) => total + record.value,
									0,
								),
						}
					: aggregateCountryMembers(
							areaCode as string,
							weightRecords,
						);
			const valueCodes = new Set(
				aggregate.members.map((record) => record.areaCode),
			);
			const weightsByCode = new Map(
				weightAggregate.members.map((record) => [
					record.areaCode,
					record,
				]),
			);
			if (
				weightAggregate.members.length !== aggregate.members.length ||
				[...valueCodes].some((code) => !weightsByCode.has(code))
			) {
				return problem(
					422,
					"Operation Not Supported",
					"The published value and weight partitions do not cover the same source areas, so no partial weighted mean was calculated.",
					{ code: "partial_coverage" },
				);
			}
			const totalWeight = weightAggregate.members.reduce(
				(total, record) => total + record.value,
				0,
			);
			if (
				!Number.isFinite(totalWeight) ||
				totalWeight <= 0 ||
				weightAggregate.members.some(
					(record) =>
						!Number.isFinite(record.value) || record.value < 0,
				)
			) {
				return problem(
					422,
					"Operation Not Supported",
					"The published weights must be finite, non-negative and sum to more than zero.",
					{ code: "aggregation_not_supported" },
				);
			}
			aggregateValue =
				aggregate.members.reduce(
					(total, record) =>
						total +
						record.value *
							(weightsByCode.get(record.areaCode)?.value ?? 0),
					0,
				) / totalWeight;
			weighting = {
				measure: weightMeasure,
				source: weightSource,
				observations: weightObservations,
				total: totalWeight,
			};
		}
		const country = location
			? undefined
			: findCountryIdentity(areaLookup, areaCode as string);
		return {
			status: 200,
			body: envelope(releaseId, {
				measure,
				source,
				period,
				sourceGeography: source.sourceGeography,
				...(location
					? { location }
					: regional
						? { region: regional.region }
						: { area: country }),
				provenance: {
					...sourceExactProvenance({
						atlasRelease: releaseId,
						measure,
						source,
						period: period as string,
						observations,
					}),
					transformation: {
						status: "not-applied",
						note: "Input observations are source-exact; no geographic conversion was applied.",
					},
					...(weighting
						? {
								weight: sourceExactProvenance({
									atlasRelease: releaseId,
									measure: weighting.measure,
									source: weighting.source,
									period: period as string,
									observations: weighting.observations,
								}),
							}
						: {}),
				},
				aggregation: location
					? {
							operation: weighting ? "weighted-mean" : "sum",
							membership: "direct-code-match",
							inputRecordCount: aggregate.members.length,
							...(weighting
								? {
										weight: {
											description:
												weightedAggregation?.weight
													.description ?? "",
											total: weighting.total,
										},
									}
								: {}),
							// Codes the sum passed over are named, so a value is
							// never quietly partial. Those of another vintage
							// have the code that replaced them standing in
							// their place; legacy aliases name no compiled area
							// at all and matched nothing.
							...(locationCoverage &&
							locationCoverage.unresolvedCount > 0
								? {
										memberCodesNotInPartition: {
											otherVintage:
												locationCoverage.unresolved
													.filter(
														(member) =>
															member.status ===
																"superseded" ||
															member.status ===
																"not-yet-current",
													)
													.map(
														(member) => member.code,
													),
											legacyAliases:
												locationCoverage.legacy.map(
													(member) => member.code,
												),
										},
									}
								: {}),
							note: weighting
								? "Every curated location member code that names an area in this partition was found in both the source-exact value and weight partitions."
								: "Every curated location member code that names an area in this partition was found in the published source partition.",
						}
					: regional
						? {
								operation: weighting ? "weighted-mean" : "sum",
								membership: "verified-full-area-overlap",
								inputRecordCount: aggregate.members.length,
								crosswalk: {
									id: regional.crosswalk.id,
									method: regional.crosswalk.method,
									quality: regional.crosswalk.quality,
								},
								...(weighting
									? {
											weight: {
												description:
													weightedAggregation?.weight
														.description ?? "",
												total: weighting.total,
											},
										}
									: {}),
								coverage: {
									...coverage,
									note: "Compares the source areas summed with every area the crosswalk places wholly in this region. `partial` means the partition publishes no value for some of them, so the total is not the region's.",
								},
								note: "Regional membership comes from the caller-selected crosswalk; every included local authority is wholly covered by this one region.",
							}
						: {
								operation: weighting ? "weighted-mean" : "sum",
								membership: "gss-country-code",
								inputRecordCount: aggregate.members.length,
								coverage: {
									...coverage,
									href: `/v1/measures/${measureId}/coverage`,
									note: "The sum covers every area of this country published in this source partition. Each assessment compares those areas with the country's areas in a boundary release the partition is assessed to match; `partial` means the release holds areas the partition publishes no value for, so the total is not a national one.",
								},
								...(weighting
									? {
											weight: {
												description:
													weightedAggregation?.weight
														.description ?? "",
												total: weighting.total,
											},
										}
									: {}),
								note: weighting
									? "Country membership follows the first character of the GSS area code, and every source-exact value has its published weight."
									: "Country membership follows the first character of the GSS area code, which the coding scheme assigns by country.",
							},
				record: { value: aggregateValue, status: "derived" },
			}),
		};
	}

	if (
		segments.length === 4 &&
		segments[0] === "v1" &&
		segments[1] === "data" &&
		segments[3] === "convert"
	) {
		if (!dataCatalog || !crosswalkLookup) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the data catalogue and crosswalks before converting observations.",
			);
		}
		const measureId = segments[2] as string;
		const measure = dataCatalog.measures.find(
			(candidate) => candidate.id === measureId,
		);
		if (!measure)
			return problem(
				404,
				"Not Found",
				"No published measure serves conversion at that path.",
			);
		// A ratio cannot be regrouped by adding it up, and area weighting a
		// share or a rank produces a number with no meaning.
		if (measure.aggregation.kind !== "extensive") {
			return problem(
				422,
				"Operation Not Supported",
				measure.aggregation.kind === "non-aggregatable"
					? `Only an extensive measure can be converted across releases. This measure is ${statisticPhrase(measure.aggregation.statistic)}: ${measure.aggregation.note}`
					: "Only an extensive measure can be converted across releases; this measure's values do not add over areas.",
				{ code: "aggregation_not_supported" },
			);
		}
		const crosswalkId = parsedUrl.searchParams.get("crosswalk");
		if (!crosswalkId)
			return problem(
				400,
				"Invalid Query",
				"crosswalk is required. This route never selects a conversion path for the caller; /v1/crosswalks lists the published ones.",
			);
		const artifact = crosswalkLookup.get(crosswalkId);
		if (!artifact)
			return problem(
				404,
				"Not Found",
				"No published crosswalk matches that id.",
			);
		const period = parsedUrl.searchParams.get("period");
		const geography = parsedUrl.searchParams.get("geography");
		const boundaryYear = parsedUrl.searchParams.get("boundaryYear");
		const source = measure.sources.find(
			(candidate) =>
				candidate.periods.includes(period ?? "") &&
				candidate.sourceGeography.type === geography &&
				String(candidate.sourceGeography.boundaryYear) === boundaryYear,
		);
		if (!source)
			return problem(
				400,
				"Invalid Query",
				`${measureId} has no published source for that period, geography and boundary year.`,
			);
		if (artifact.from.geography !== source.sourceGeography.type) {
			return problem(
				422,
				"Operation Not Supported",
				`That crosswalk starts at ${artifact.from.geography}, but this source partition is published on ${source.sourceGeography.type} areas.`,
				{
					code: "conversion_not_available",
					absence: "crosswalk-geography-mismatch",
				},
			);
		}
		const observations = observationsFor(
			measureId,
			source,
			period as string,
			{
				populationObservations,
				populationLocalAuthorityObservations,
				measureObservations,
			},
		);
		if (!observations)
			return problem(
				503,
				"Catalogue Unavailable",
				`The observation artifact for ${measureId} is missing, or does not contain the catalogue's declared source period.`,
			);
		const numericRecords =
			observations.records.filter(isNumericObservation);
		if (numericRecords.length !== observations.records.length) {
			return problem(
				503,
				"Catalogue Unavailable",
				`The observation artifact for ${measureId} does not contain numeric records required for conversion.`,
			);
		}
		const converted = convertObservations(artifact, numericRecords);
		if (converted.status === "refused") {
			return problem(422, "Operation Not Supported", converted.reason, {
				code: "conversion_not_available",
				absence: converted.absence,
				areaCount: converted.areaCount,
				areaSample: converted.areaSample,
			});
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
		if (cursor && !cursorCode)
			return problem(400, "Invalid Query", "cursor is invalid.");
		const offset = cursorCode
			? converted.records.findIndex(
					(record) => record.areaCode === cursorCode,
				) + 1
			: 0;
		if (cursorCode && offset === 0)
			return problem(
				400,
				"Invalid Query",
				"cursor is not valid for this conversion.",
			);
		const page = converted.records.slice(offset, offset + pageSize);
		const lastRecord = page.at(-1);
		const nextCursor =
			offset + page.length < converted.records.length && lastRecord
				? cursorFor(lastRecord.areaCode)
				: null;
		return {
			status: 200,
			body: envelope(
				releaseId,
				{
					measure,
					source,
					period,
					sourceGeography: source.sourceGeography,
					targetGeography: {
						type: artifact.to.geography,
						boundaryRelease: artifact.to.boundaryRelease,
					},
					provenance: {
						...sourceExactProvenance({
							atlasRelease: releaseId,
							measure,
							source,
							period: period as string,
							observations,
						}),
						transformation: {
							status: "applied" as const,
							note: "Input observations are source-exact; the values below were regrouped onto the crosswalk's target areas.",
						},
					},
					conversion: {
						crosswalk: {
							id: artifact.id,
							href: `/v1/crosswalks/${artifact.id}`,
							method: artifact.method,
							quality: artifact.quality,
							weighting: artifact.weighting,
							contentHash: artifact.contentHash,
						},
						method: converted.method,
						inputRecordCount: converted.inputRecordCount,
						outputRecordCount: converted.records.length,
						note:
							converted.method === "exact"
								? "Every source area sits wholly within one target, so this is a regrouping and the partition total is unchanged."
								: "Sources split across targets were apportioned by overlapping area. This is an estimate: it assumes the measure is spread evenly across each source area.",
					},
					aggregation: null,
					records: page,
				},
				nextCursor,
			),
		};
	}

	if (
		segments.length === 4 &&
		segments[0] === "v1" &&
		segments[1] === "data" &&
		segments[3] === "compare"
	) {
		if (!dataCatalog) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the data catalogue before comparing source-exact observations.",
			);
		}
		const measureId = segments[2] as string;
		const measure = dataCatalog.measures.find(
			(candidate) => candidate.id === measureId,
		);
		if (!measure) {
			return problem(
				404,
				"Not Found",
				"No published measure serves comparisons at that path.",
			);
		}
		if (measure.valueKind === "categorical") {
			return problem(
				422,
				"Operation Not Supported",
				"Categorical measures have no numeric difference to compare.",
			);
		}
		if (
			parsedUrl.searchParams.has("release") ||
			parsedUrl.searchParams.has("conversion") ||
			parsedUrl.searchParams.has("aggregate")
		) {
			return problem(
				422,
				"Operation Not Supported",
				"This source-exact comparison endpoint does not select geometry releases, convert observations or aggregate them.",
			);
		}
		const period = parsedUrl.searchParams.get("period");
		const geography = parsedUrl.searchParams.get("geography");
		const boundaryYear = parsedUrl.searchParams.get("boundaryYear");
		const baselineAreaCode = parsedUrl.searchParams.get("baselineAreaCode");
		const comparisonAreaCode =
			parsedUrl.searchParams.get("comparisonAreaCode");
		if (!baselineAreaCode || !comparisonAreaCode) {
			return problem(
				400,
				"Invalid Query",
				"baselineAreaCode and comparisonAreaCode are required.",
			);
		}
		if (baselineAreaCode === comparisonAreaCode) {
			return problem(
				400,
				"Invalid Query",
				"baselineAreaCode and comparisonAreaCode must differ.",
			);
		}
		const source = measure.sources.find(
			(candidate) =>
				candidate.periods.includes(period ?? "") &&
				candidate.sourceGeography.type === geography &&
				String(candidate.sourceGeography.boundaryYear) === boundaryYear,
		);
		if (!source) {
			return problem(
				400,
				"Invalid Query",
				`${measureId} supports comparisons only for a published source period, geography and boundary year.`,
			);
		}
		const observations = observationsFor(
			measureId,
			source,
			period as string,
			{
				populationObservations,
				populationLocalAuthorityObservations,
				measureObservations,
			},
		);
		if (!observations) {
			return problem(
				503,
				"Catalogue Unavailable",
				`The observation artifact for ${measureId} is missing, or does not contain the catalogue's declared source period.`,
			);
		}
		const numericRecords =
			observations.records.filter(isNumericObservation);
		if (numericRecords.length !== observations.records.length) {
			return problem(
				503,
				"Catalogue Unavailable",
				`The observation artifact for ${measureId} does not contain numeric records required for comparison.`,
			);
		}
		const baseline = numericRecords.find(
			(record) => record.areaCode === baselineAreaCode,
		);
		const comparison = numericRecords.find(
			(record) => record.areaCode === comparisonAreaCode,
		);
		if (!baseline || !comparison) {
			return problem(
				404,
				"Not Found",
				"One or both requested area codes have no published source-exact observation.",
			);
		}
		return {
			status: 200,
			body: envelope(releaseId, {
				measure,
				source,
				period,
				sourceGeography: source.sourceGeography,
				provenance: sourceExactProvenance({
					atlasRelease: releaseId,
					measure,
					source,
					period: period as string,
					observations,
				}),
				comparison: compareObservations(measure, baseline, comparison),
			}),
		};
	}

	if (
		segments.length === 4 &&
		segments[0] === "v1" &&
		segments[1] === "measures" &&
		segments[3] === "compatibility"
	) {
		if (!measureCompatibilityInventory) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build measure compatibility before retrieving compatible boundary releases.",
			);
		}
		const measure = measureCompatibilityInventory.measures.find(
			(candidate) => candidate.measureId === segments[2],
		);
		return measure
			? {
					status: 200,
					body: envelope(releaseId, {
						...measure,
						note: "Candidates report code-set compatibility only. They do not select a geometry release or assert equal geometry.",
					}),
				}
			: problem(
					404,
					"Not Found",
					"No published measure compatibility record matches that id.",
				);
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "places"
	) {
		const query = parsedUrl.searchParams.get("q")?.trim();
		if (!query) {
			return problem(
				400,
				"Invalid Query",
				"q is required: a place name, an area code, or a place reference such as localAuthority/E08000003.",
			);
		}
		const limit = readPageSize(parsedUrl.searchParams.get("limit") ?? "10");
		if (limit === undefined) {
			return problem(
				400,
				"Invalid Query",
				`limit must be an integer between 1 and ${MAX_PAGE_SIZE}.`,
			);
		}
		if (!areaLookup) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the area inventory before resolving place names.",
			);
		}
		const candidates = resolvePlaces(
			placeIndexFor(areaLookup, namedLocationInventory),
			query,
			limit,
		);
		return {
			status: 200,
			body: envelope(releaseId, {
				query,
				candidates: candidates.map((candidate) => ({
					...describeCandidate(candidate),
					boundaryReleases: candidate.boundaryReleases,
					...(candidate.memberCodes
						? { memberCodes: candidate.memberCodes }
						: {}),
				})),
				note: "Candidates are every place the name could mean, exact matches first and then names beginning with it. Equal matches are listed headline geographies first, a presentation order that asserts nothing about which was meant. Pass a candidate's place reference to a value request to ask about that place alone.",
			}),
		};
	}

	if (
		segments.length === 4 &&
		segments[0] === "v1" &&
		segments[1] === "data" &&
		segments[3] === "value"
	) {
		if (!dataCatalog) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the data catalogue before answering for a place.",
			);
		}
		const measureId = segments[2] as string;
		const measure = dataCatalog.measures.find(
			(candidate) => candidate.id === measureId,
		);
		if (!measure) {
			return problem(
				404,
				"Not Found",
				`No published measure ${measureId}. GET /v1/measures lists them.`,
			);
		}
		const place = parsedUrl.searchParams.get("place")?.trim();
		if (!place) {
			return problem(
				400,
				"Invalid Query",
				"place is required: a place name such as North West, an area code, or a place reference from /v1/places.",
			);
		}
		if (!areaLookup) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the area inventory before answering for a place.",
			);
		}
		const period =
			parsedUrl.searchParams.get("period")?.trim() || undefined;
		const candidates = resolvePlaces(
			placeIndexFor(areaLookup, namedLocationInventory),
			place,
			12,
		);
		// Each candidate goes to the route that already serves its kind of
		// place, so the value and every refusal are exactly what that route
		// gives when called directly.
		const outcome = valueForPlace(measure, candidates, period, (url) =>
			route("GET", url, context),
		);
		if (outcome.outcome === "unmatched") {
			return problem(
				404,
				"Unknown Place",
				`No place is called or coded "${place}". GET /v1/places?q= searches names, and matches the start of a name as well as the whole.`,
			);
		}
		if (outcome.outcome === "unserved") {
			return problem(
				422,
				"Place Not Served",
				`"${place}" matched ${outcome.attempts.length} place${outcome.attempts.length === 1 ? "" : "s"}, and ${measureId} answers none of them. Each candidate below says why.`,
				{ candidates: outcome.attempts.map(describeAttempt) },
			);
		}
		if (outcome.outcome === "ambiguous") {
			return problem(
				409,
				"Ambiguous Place",
				`"${place}" names ${outcome.choices.length} places that ${measureId} answers differently. Each choice carries its answer; ask again with the place reference of the one meant.`,
				{
					choices: outcome.choices.map((choice) => ({
						...describeAttempt(choice),
						ask: `/v1/data/${measureId}/value?place=${encodeURIComponent(choice.candidate.place)}${period ? `&period=${encodeURIComponent(period)}` : ""}`,
					})),
				},
			);
		}
		const { chosen, attempts } = outcome;
		return {
			status: 200,
			body: envelope(releaseId, {
				measure: {
					id: measure.id,
					label: measure.label,
					valueKind: measure.valueKind,
					unit: measure.unit,
				},
				question: { place, period: period ?? null },
				answer: { ...chosen.answer, unit: measure.unit },
				place: describeCandidate(chosen.candidate),
				method: chosen.method,
				// The call that gives this answer directly, with its full
				// provenance, for a caller that wants to cite or repeat it.
				via: chosen.via,
				otherMatches: attempts
					.filter((attempt) => attempt !== chosen)
					.map(describeAttempt),
				note: [
					chosen.answer.periodDefaulted
						? `No period was given, so the latest published, ${chosen.answer.period}, was used.`
						: undefined,
					chosen.method === "aggregate"
						? "Summed from the local authorities the place is made of; the aggregate route's response, at via, lists any member codes of another vintage it passed over."
						: "The value as published for this area.",
					attempts.length > 1
						? "The name matched other places, listed in otherMatches; any that cover the same ground as this one gave the same answer."
						: undefined,
				]
					.filter(Boolean)
					.join(" "),
			}),
		};
	}

	if (
		segments.length === 4 &&
		segments[0] === "v1" &&
		segments[1] === "data" &&
		segments[3] === "change"
	) {
		if (!dataCatalog) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the data catalogue before measuring change.",
			);
		}
		const measureId = segments[2] as string;
		const measure = dataCatalog.measures.find(
			(candidate) => candidate.id === measureId,
		);
		if (!measure) {
			return problem(
				404,
				"Not Found",
				"No published measure serves change at that path.",
			);
		}
		const refusal = changeRefusal(measure);
		if (refusal) {
			return problem(422, "Operation Not Supported", refusal);
		}
		if (
			parsedUrl.searchParams.has("release") ||
			parsedUrl.searchParams.has("conversion") ||
			parsedUrl.searchParams.has("aggregate")
		) {
			return problem(
				422,
				"Operation Not Supported",
				"Change is measured within one source partition. It does not select geometry releases, convert observations or aggregate them.",
			);
		}
		const geography = parsedUrl.searchParams.get("geography");
		const boundaryYear = parsedUrl.searchParams.get("boundaryYear");
		const startPeriod = parsedUrl.searchParams.get("startPeriod");
		const endPeriod = parsedUrl.searchParams.get("endPeriod");
		const partitions = measure.sources
			.map(
				(candidate) =>
					`geography=${candidate.sourceGeography.type}&boundaryYear=${candidate.sourceGeography.boundaryYear} (${candidate.periods.length} period${candidate.periods.length === 1 ? "" : "s"})`,
			)
			.join("; ");
		/*
		 * Change is measured inside one partition, never across two. The
		 * publisher restates every period of a partition on a single set of
		 * codes, so an area code names the same ground at the start and the
		 * end; pairing periods from partitions on different codes would pair
		 * areas that are not the same place.
		 */
		const source = measure.sources.find(
			(candidate) =>
				candidate.sourceGeography.type === geography &&
				String(candidate.sourceGeography.boundaryYear) === boundaryYear,
		);
		if (!source || !startPeriod || !endPeriod) {
			return problem(
				400,
				"Invalid Query",
				`${measureId} measures change within one source partition: give geography, boundaryYear, startPeriod and endPeriod. Published partitions: ${partitions}.`,
			);
		}
		if (source.periods.length < 2) {
			return problem(
				422,
				"Operation Not Supported",
				`${measureId} publishes a single period (${source.periods[0]}) for this partition, so there is no change to measure.`,
			);
		}
		const startIndex = source.periods.indexOf(startPeriod);
		const endIndex = source.periods.indexOf(endPeriod);
		if (startIndex === -1 || endIndex === -1) {
			return problem(
				400,
				"Invalid Query",
				`startPeriod and endPeriod must be published periods of this partition: ${source.periods.join(", ")}.`,
			);
		}
		if (startIndex >= endIndex) {
			return problem(
				400,
				"Invalid Query",
				"startPeriod must come before endPeriod, so the sign of a change is never ambiguous.",
			);
		}
		if (periodsOverlap(startPeriod, endPeriod)) {
			return problem(
				422,
				"Operation Not Supported",
				`${startPeriod} and ${endPeriod} share years, so most of the apparent change between them is the same data counted twice. Choose periods that do not overlap.`,
			);
		}
		const basisParameter = parsedUrl.searchParams.get("by") ?? "absolute";
		if (basisParameter !== "absolute" && basisParameter !== "relative") {
			return problem(
				400,
				"Invalid Query",
				"by must be absolute or relative.",
			);
		}
		const basis: ChangeBasis = basisParameter;
		if (basis === "relative") {
			const relativeRefusal = relativeChangeRefusal(measure);
			if (relativeRefusal) {
				return problem(400, "Invalid Query", relativeRefusal);
			}
		}
		const order = readRankingOrder(parsedUrl.searchParams.get("order"));
		if (!order) {
			return problem(400, "Invalid Query", "order must be asc or desc.");
		}
		const artifacts = {
			populationObservations,
			populationLocalAuthorityObservations,
			measureObservations,
		};
		const startObservations = observationsFor(
			measureId,
			source,
			startPeriod,
			artifacts,
		);
		const endObservations = observationsFor(
			measureId,
			source,
			endPeriod,
			artifacts,
		);
		if (!startObservations || !endObservations) {
			return problem(
				503,
				"Catalogue Unavailable",
				`The observation artifact for ${measureId} is missing, or does not contain both declared periods.`,
			);
		}
		const startRecords =
			startObservations.records.filter(isNumericObservation);
		const endRecords = endObservations.records.filter(isNumericObservation);
		if (
			startRecords.length !== startObservations.records.length ||
			endRecords.length !== endObservations.records.length
		) {
			return problem(
				503,
				"Catalogue Unavailable",
				`The observation artifact for ${measureId} does not contain numeric records required for change.`,
			);
		}
		const changeSet = computeChanges(measure, startRecords, endRecords);
		const rankable = changeSet.changes.flatMap((change) => {
			const value = changeValue(change, basis);
			return value === undefined
				? []
				: [
						{
							areaCode: change.areaCode,
							value,
							status: "derived" as const,
						},
					];
		});
		const changeByCode = new Map(
			changeSet.changes.map((change) => [change.areaCode, change]),
		);
		const ranked = rankObservations(rankable, order).map((entry) => {
			const change = changeByCode.get(entry.areaCode)!;
			return {
				areaCode: entry.areaCode,
				rank: entry.rank,
				tieCount: entry.tieCount,
				start: { period: startPeriod, ...change.start },
				end: { period: endPeriod, ...change.end },
				absoluteChange: change.absoluteChange,
				relativeChange: change.relativeChange,
				...(change.intervalsOverlap === undefined
					? {}
					: { intervalsOverlap: change.intervalsOverlap }),
			};
		});

		// One area, with its place among all of them: "rose 12%, fifth fastest".
		const areaCode = parsedUrl.searchParams.get("areaCode");
		let records = ranked;
		let nextCursor: string | null = null;
		if (areaCode) {
			const record = ranked.find((entry) => entry.areaCode === areaCode);
			if (!record) {
				const reason = changeSet.onlyAtStart.includes(areaCode)
					? `it has a value in ${startPeriod} but none in ${endPeriod}`
					: changeSet.onlyAtEnd.includes(areaCode)
						? `it has a value in ${endPeriod} but none in ${startPeriod}`
						: changeByCode.has(areaCode)
							? "its start value is zero, so it has no relative change"
							: "it is not in this partition";
				return problem(
					404,
					"Not Found",
					`No change for ${areaCode}: ${reason}.`,
				);
			}
			records = [record];
		} else {
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
				? ranked.findIndex((entry) => entry.areaCode === cursorCode) + 1
				: 0;
			if (cursorCode && offset === 0) {
				return problem(
					400,
					"Invalid Query",
					"cursor is not valid for this change query.",
				);
			}
			records = ranked.slice(offset, offset + pageSize);
			const last = records.at(-1);
			nextCursor =
				offset + records.length < ranked.length && last
					? cursorFor(last.areaCode)
					: null;
		}
		const withIntervals = changeSet.changes.some(
			(change) => change.intervalsOverlap !== undefined,
		);
		return {
			status: 200,
			body: envelope(
				releaseId,
				{
					measure,
					source,
					sourceGeography: source.sourceGeography,
					startPeriod,
					endPeriod,
					provenance: sourceSeriesProvenance({
						atlasRelease: releaseId,
						measure,
						source,
						periods: [startPeriod, endPeriod],
						observations: endObservations,
					}),
					change: {
						direction: "end-minus-start",
						basis,
						order,
						unit:
							basis === "relative" ? "proportion" : measure.unit,
						interpretation:
							measure.valueKind === "currency"
								? `Nominal change in ${measure.unit}. Values are as published and not adjusted for inflation.`
								: measure.valueKind === "ratio"
									? "Change in points of the source-published ratio."
									: "Change in the source-published unit.",
						ranking: {
							method: "competition",
							note: "Equal changes share a rank; the following rank accounts for every preceding area (for example 1, 1, 3).",
						},
						...(withIntervals
							? {
									uncertainty:
										"intervalsOverlap reports whether the published intervals at the start and end overlap. Intervals that do not overlap mean the change is unlikely to be chance; intervals that do overlap do not show that it is.",
								}
							: {}),
					},
					coverage: {
						areasRanked: ranked.length,
						areasWithBothPeriods: changeSet.changes.length,
						onlyAtStart: changeSet.onlyAtStart,
						onlyAtEnd: changeSet.onlyAtEnd,
						// Only ever non-zero for relative change, where a zero start
						// has no share to express the change as.
						withoutRelativeChange:
							changeSet.changes.length - ranked.length,
						note: "Change is measured only for areas with a value in both periods. Areas in one period only are listed, not paired with anything.",
					},
					records,
				},
				nextCursor,
			),
		};
	}

	if (
		segments.length === 4 &&
		segments[0] === "v1" &&
		segments[1] === "data" &&
		segments[3] === "rankings"
	) {
		if (!dataCatalog) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the data catalogue before retrieving source-exact rankings.",
			);
		}
		const measureId = segments[2] as string;
		const measure = dataCatalog.measures.find(
			(candidate) => candidate.id === measureId,
		);
		if (!measure) {
			return problem(
				404,
				"Not Found",
				"No published measure serves rankings at that path.",
			);
		}
		if (measure.valueKind === "categorical") {
			return problem(
				422,
				"Operation Not Supported",
				"Categorical measures have no numeric order to rank.",
			);
		}
		if (
			parsedUrl.searchParams.has("release") ||
			parsedUrl.searchParams.has("conversion") ||
			parsedUrl.searchParams.has("aggregate")
		) {
			return problem(
				422,
				"Operation Not Supported",
				"This source-exact ranking endpoint does not select geometry releases, convert observations or aggregate them.",
			);
		}
		const period = parsedUrl.searchParams.get("period");
		const geography = parsedUrl.searchParams.get("geography");
		const boundaryYear = parsedUrl.searchParams.get("boundaryYear");
		const source = measure.sources.find(
			(candidate) =>
				candidate.periods.includes(period ?? "") &&
				candidate.sourceGeography.type === geography &&
				String(candidate.sourceGeography.boundaryYear) === boundaryYear,
		);
		if (!source) {
			return problem(
				400,
				"Invalid Query",
				`${measureId} supports rankings only for a published source period, geography and boundary year.`,
			);
		}
		const observations = observationsFor(
			measureId,
			source,
			period as string,
			{
				populationObservations,
				populationLocalAuthorityObservations,
				measureObservations,
			},
		);
		if (!observations) {
			return problem(
				503,
				"Catalogue Unavailable",
				`The observation artifact for ${measureId} is missing, or does not contain the catalogue's declared source period.`,
			);
		}
		const numericRecords =
			observations.records.filter(isNumericObservation);
		if (numericRecords.length !== observations.records.length) {
			return problem(
				503,
				"Catalogue Unavailable",
				`The observation artifact for ${measureId} does not contain numeric records required for ranking.`,
			);
		}
		const order = readRankingOrder(parsedUrl.searchParams.get("order"));
		if (!order) {
			return problem(400, "Invalid Query", "order must be asc or desc.");
		}
		const ranked = rankObservations(numericRecords, order);
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
			? ranked.findIndex((record) => record.areaCode === cursorCode) + 1
			: 0;
		if (cursorCode && offset === 0) {
			return problem(
				400,
				"Invalid Query",
				"cursor is not valid for this ranking query.",
			);
		}
		const records = ranked.slice(offset, offset + pageSize);
		const lastRecord = records.at(-1);
		const nextCursor =
			offset + records.length < ranked.length && lastRecord
				? cursorFor(lastRecord.areaCode)
				: null;
		return {
			status: 200,
			body: envelope(
				releaseId,
				{
					measure,
					source,
					period,
					sourceGeography: source.sourceGeography,
					provenance: sourceExactProvenance({
						atlasRelease: releaseId,
						measure,
						source,
						period: period as string,
						observations,
					}),
					ranking: {
						order,
						method: "competition",
						note: "Equal values share a rank; the following rank accounts for every preceding observation (for example 1, 1, 3).",
					},
					records,
				},
				nextCursor,
			),
		};
	}

	if (
		segments.length === 4 &&
		segments[0] === "v1" &&
		segments[1] === "measures" &&
		segments[3] === "coverage"
	) {
		if (!dataCatalog || !measureCompatibilityInventory) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the data catalogue and measure compatibility before retrieving measure coverage.",
			);
		}
		const coverage = measureCoverage(
			dataCatalog,
			measureCompatibilityInventory,
			segments[2] as string,
		);
		return coverage
			? { status: 200, body: envelope(releaseId, coverage) }
			: problem(
					404,
					"Not Found",
					"No published measure coverage record matches that id.",
				);
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "measures"
	) {
		return dataCatalog
			? { status: 200, body: envelope(releaseId, dataCatalog.measures) }
			: problem(
					503,
					"Catalogue Unavailable",
					"Build the data catalogue before listing measures.",
				);
	}

	if (
		segments.length === 3 &&
		segments[0] === "v1" &&
		segments[1] === "measures"
	) {
		if (!dataCatalog) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the data catalogue before retrieving measures.",
			);
		}
		const measure = dataCatalog.measures.find(
			(candidate) => candidate.id === segments[2],
		);
		return measure
			? { status: 200, body: envelope(releaseId, measure) }
			: problem(
					404,
					"Not Found",
					"No published measure matches that id.",
				);
	}

	if (
		segments.length === 4 &&
		segments[0] === "v1" &&
		segments[1] === "data" &&
		segments[3] === "series"
	) {
		if (!dataCatalog) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the data catalogue before retrieving source-exact series.",
			);
		}
		const measureId = segments[2] as string;
		const measure = dataCatalog.measures.find(
			(candidate) => candidate.id === measureId,
		);
		if (!measure) {
			return problem(
				404,
				"Not Found",
				"No published measure serves a series at that path.",
			);
		}
		if (
			parsedUrl.searchParams.has("release") ||
			parsedUrl.searchParams.has("conversion") ||
			parsedUrl.searchParams.has("aggregate")
		) {
			return problem(
				422,
				"Operation Not Supported",
				"This source-exact series endpoint does not select geometry releases, convert observations or aggregate them.",
			);
		}
		const areaCode = parsedUrl.searchParams.get("areaCode");
		const geography = parsedUrl.searchParams.get("geography");
		const boundaryYear = parsedUrl.searchParams.get("boundaryYear");
		const datasetId = parsedUrl.searchParams.get("datasetId");
		if (!areaCode || !geography || !boundaryYear) {
			return problem(
				400,
				"Invalid Query",
				"areaCode, geography and boundaryYear are required for a source-exact series.",
			);
		}
		const matchingSources = measure.sources.filter(
			(source) =>
				source.sourceGeography.type === geography &&
				String(source.sourceGeography.boundaryYear) === boundaryYear &&
				(datasetId === null || source.datasetId === datasetId),
		);
		if (matchingSources.length !== 1) {
			return problem(
				400,
				"Invalid Query",
				matchingSources.length === 0
					? `${measureId} has no published source for that geography, boundary year and dataset.`
					: "datasetId is required because more than one source matches that geography and boundary year.",
			);
		}
		const source = matchingSources[0] as MeasureSource;
		const observationsByPeriod = source.periods.map((period) => ({
			period,
			observations: observationsFor(measureId, source, period, {
				populationObservations,
				populationLocalAuthorityObservations,
				measureObservations,
			}),
		}));
		if (observationsByPeriod.some(({ observations }) => !observations)) {
			return problem(
				503,
				"Catalogue Unavailable",
				`The observation artifact for ${measureId} does not contain every period declared by the catalogue.`,
			);
		}
		const available = observationsByPeriod as Array<{
			period: string;
			observations: ObservationArtifactReference & {
				records: PopulationObservation[];
			};
		}>;
		const records = available.flatMap(({ period, observations }) => {
			const record = observations.records.find(
				(candidate) => candidate.areaCode === areaCode,
			);
			return record ? [{ period, ...record }] : [];
		});
		if (records.length === 0) {
			return problem(
				404,
				"Not Found",
				"No published source-exact observations match that area code.",
			);
		}
		const firstObservations = available[0]?.observations;
		if (!firstObservations) {
			return problem(
				503,
				"Catalogue Unavailable",
				"The measure source declares no observation periods.",
			);
		}
		return {
			status: 200,
			body: envelope(releaseId, {
				measure,
				source,
				areaCode,
				sourceGeography: source.sourceGeography,
				provenance: sourceSeriesProvenance({
					atlasRelease: releaseId,
					measure,
					source,
					periods: source.periods,
					observations: firstObservations,
				}),
				series: records,
			}),
		};
	}

	if (
		segments.length === 3 &&
		segments[0] === "v1" &&
		segments[1] === "data"
	) {
		if (!dataCatalog) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the data catalogue before retrieving observations.",
			);
		}
		const measureId = segments[2] as string;
		const measure = dataCatalog.measures.find(
			(candidate) => candidate.id === measureId,
		);
		if (!measure) {
			return problem(
				404,
				"Not Found",
				"No published measure serves data at that path.",
			);
		}
		const period = parsedUrl.searchParams.get("period");
		const geography = parsedUrl.searchParams.get("geography");
		const boundaryYear = parsedUrl.searchParams.get("boundaryYear");
		const source = measure.sources.find(
			(candidate) =>
				candidate.periods.includes(period ?? "") &&
				candidate.sourceGeography.type === geography &&
				String(candidate.sourceGeography.boundaryYear) === boundaryYear,
		);
		if (!source) {
			return problem(
				400,
				"Invalid Query",
				`${measureId} supports only a published source period, geography and boundary year; inspect /v1/measures/${measureId} for available sources.`,
			);
		}
		const requestedRelease = parsedUrl.searchParams.get("release");
		let geometry: CallerSelectedGeometry | undefined;
		if (requestedRelease) {
			if (!measureCompatibilityInventory) {
				return problem(
					503,
					"Catalogue Unavailable",
					"Build measure compatibility before selecting a geometry release for observations.",
				);
			}
			const compatibilitySource = measureCompatibilityInventory.measures
				.find((candidate) => candidate.measureId === measureId)
				?.sources.find(
					(candidate) =>
						candidate.datasetId === source.datasetId &&
						candidate.sourceGeography.type ===
							source.sourceGeography.type &&
						candidate.sourceGeography.boundaryYear ===
							source.sourceGeography.boundaryYear &&
						candidate.periods.includes(period ?? ""),
				);
			const candidate = compatibilitySource?.candidates.find(
				(candidate) => candidate.boundaryRelease === requestedRelease,
			);
			if (
				!candidate ||
				(candidate.status !== "exact-code-set" &&
					candidate.status !== "code-set-compatible") ||
				candidate.unmatchedSourceCodeCount !== 0 ||
				candidate.matchedSourceShare !== 1
			) {
				return problem(
					422,
					"Operation Not Supported",
					`The requested release does not contain every source area code for this measure partition. Inspect /v1/measures/${measureId}/compatibility for supported candidates.`,
				);
			}
			geometry = {
				boundaryRelease: candidate.boundaryRelease,
				selection: "caller-specified",
				compatibility: candidate.status,
				areaIdentityTemplate: `${source.sourceGeography.type}/${candidate.boundaryRelease}/{areaCode}`,
				note: "Values remain source-exact and are joined to this caller-selected geometry by matching area code. This is not a geometry conversion or an assertion of equal geometry.",
			};
		}
		if (
			parsedUrl.searchParams.has("conversion") ||
			parsedUrl.searchParams.has("aggregate")
		) {
			return problem(
				422,
				"Operation Not Supported",
				"This source-exact endpoint does not yet convert observations or aggregate them.",
			);
		}
		const areaCode = parsedUrl.searchParams.get("areaCode");
		const include = parsedUrl.searchParams.get("include");
		const requestedFormat = parsedUrl.searchParams.get("format") ?? "json";
		if (
			requestedFormat !== "json" &&
			requestedFormat !== "csv" &&
			requestedFormat !== "ndjson"
		) {
			return problem(
				400,
				"Invalid Query",
				"format must be one of json, csv or ndjson.",
			);
		}
		if (measure.valueKind === "categorical" && requestedFormat !== "json") {
			return problem(
				422,
				"Operation Not Supported",
				"Tabular exports currently support numeric measures only; request JSON for categorical observations.",
			);
		}
		if (include !== null && include !== "area") {
			return problem(
				400,
				"Invalid Query",
				"include currently supports only area.",
			);
		}
		if (include === "area" && !geometry) {
			return problem(
				400,
				"Invalid Query",
				"include=area requires a caller-selected compatible release.",
			);
		}
		if (include === "area" && !areaLookup) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the area inventory before including canonical area identities.",
			);
		}
		const observations = observationsFor(
			measureId,
			source,
			period as string,
			{
				populationObservations,
				populationLocalAuthorityObservations,
				measureObservations,
			},
		);
		if (!observations) {
			return problem(
				503,
				"Catalogue Unavailable",
				`The observation artifact for ${measureId} is missing, or does not contain the catalogue's declared source period.`,
			);
		}
		const sourceRecords = observations.records;
		const provenance = sourceExactProvenance({
			atlasRelease: releaseId,
			measure,
			source,
			period: period as string,
			observations,
			geometry,
		});
		const matches = areaCode
			? sourceRecords.filter((record) => record.areaCode === areaCode)
			: sourceRecords;
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
			? matches.findIndex((record) => record.areaCode === cursorCode) + 1
			: 0;
		if (cursorCode && offset === 0) {
			return problem(
				400,
				"Invalid Query",
				"cursor is not valid for this population query.",
			);
		}
		const records = matches.slice(offset, offset + pageSize);
		const recordsWithAreas =
			include === "area"
				? records.map((record) => {
						const area = findArea(
							areaLookup,
							source.sourceGeography.type,
							geometry?.boundaryRelease ?? "",
							record.areaCode,
						);
						if (!area) return undefined;
						return {
							...record,
							area: {
								id: `${source.sourceGeography.type}/${geometry?.boundaryRelease}/${area.code}`,
								...area,
							},
						};
					})
				: records;
		if (recordsWithAreas.some((record) => record === undefined)) {
			return problem(
				503,
				"Catalogue Unavailable",
				"The selected release is compatible but its compiled area inventory is incomplete.",
			);
		}
		const resolvedRecords = recordsWithAreas.filter(
			(record) => record !== undefined,
		);
		const exportRecords = resolvedRecords.filter(
			(record): record is MeasureExportRecord =>
				isNumericObservation(record),
		);
		const lastRecord = records.at(-1);
		const nextCursor =
			offset + records.length < matches.length && lastRecord
				? cursorFor(lastRecord.areaCode)
				: null;
		if (requestedFormat !== "json") {
			const exported = exportMeasureRecords(
				requestedFormat as TabularFormat,
				{
					atlasRelease: releaseId,
					measureId: measure.id,
					unit: measure.unit,
					source,
					period: period as string,
					geometry,
					records: exportRecords,
				},
			);
			return {
				status: 200,
				body: envelope(
					releaseId,
					{
						format: requestedFormat,
						rowCount: exportRecords.length,
					},
					nextCursor,
				),
				representation: {
					...exported,
					// A tabular body carries no envelope, so the only way a
					// caller can tell a page from the whole partition is the
					// link relation. Without it an export silently stops at
					// the page size.
					headers: nextCursor
						? {
								link: `<${nextPageHref(parsedUrl, nextCursor)}>; rel="next"`,
							}
						: {},
				},
			};
		}
		return {
			status: 200,
			body: envelope(
				releaseId,
				{
					measure,
					source,
					period,
					sourceGeography: source.sourceGeography,
					...(geometry === undefined ? {} : { geometry }),
					provenance,
					conversion: null,
					aggregation: null,
					records: resolvedRecords,
				},
				nextCursor,
			),
		};
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "areas:contains"
	) {
		const longitude = readCoordinate(
			parsedUrl.searchParams.get("lng"),
			-180,
			180,
		);
		const latitude = readCoordinate(
			parsedUrl.searchParams.get("lat"),
			-90,
			90,
		);
		const geography = parsedUrl.searchParams.get("geography");
		const boundaryRelease = parsedUrl.searchParams.get("release");
		if (
			longitude === undefined ||
			latitude === undefined ||
			!geography ||
			!boundaryRelease
		) {
			return problem(
				400,
				"Invalid Query",
				"lng (-180 to 180), lat (-90 to 90), geography and release are required.",
			);
		}
		if (!areaLookup || !areaGeometryCache) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the area inventory and geometry source registry before point lookup.",
			);
		}
		if (!areaLookup.has(`${geography}/${boundaryRelease}`)) {
			return problem(
				404,
				"Not Found",
				"No compiled area release matches the requested geography and release.",
			);
		}
		try {
			const matches = areaGeometryCache
				.findContaining(geography, boundaryRelease, [
					longitude,
					latitude,
				])
				.flatMap(({ code, containment }) => {
					const area = findArea(
						areaLookup,
						geography,
						boundaryRelease,
						code,
					);
					return area
						? [
								{
									id: `${geography}/${boundaryRelease}/${code}`,
									...area,
									containment,
									geometrySource:
										areaGeometryCache.provenance(
											geography,
											boundaryRelease,
											code,
										),
								},
							]
						: [];
				});
			return {
				status: 200,
				body: envelope(releaseId, {
					point: { lng: longitude, lat: latitude },
					geography,
					boundaryRelease,
					boundaryRule: "included",
					matches,
				}),
			};
		} catch (error) {
			return problem(
				503,
				"Geometry Unavailable",
				error instanceof Error
					? error.message
					: "Geometry could not be loaded for point lookup.",
			);
		}
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "areas:validate"
	) {
		const geography = parsedUrl.searchParams.get("geography");
		const boundaryRelease = parsedUrl.searchParams.get("release");
		const values = parsedUrl.searchParams.getAll("value");
		if (!geography || !boundaryRelease)
			return problem(
				400,
				"Invalid Query",
				"geography and release are required: values are validated against one exact boundary release. /v1/boundary-releases:resolve finds the release for a date.",
			);
		if (values.length === 0)
			return problem(
				400,
				"Invalid Query",
				"Supply at least one value to validate, as value=; it may be repeated.",
			);
		if (values.length > MAX_BATCH_VALUES)
			return problem(
				400,
				"Invalid Query",
				`At most ${MAX_BATCH_VALUES} values can be validated in one request; this one has ${values.length}.`,
			);
		if (!areaLookup?.has(`${geography}/${boundaryRelease}`))
			return areaNotFound(geography, boundaryRelease, "");
		const results = validateBatch(
			areaLookup,
			geography,
			boundaryRelease,
			values,
		);
		return {
			status: 200,
			body: envelope(releaseId, {
				geography,
				boundaryRelease,
				summary: summariseBatch(results),
				values: results,
				note: 'Codes are checked against this exact release; one it does not hold says whether other releases or geographies do. Names match only exactly, through a published alias, or with an administrative title such as "City of" set aside, and a name meaning several areas lists them all rather than choosing. Anything trimmed or re-cased to read a value is listed in normalised. joinable is true only when every value names exactly one area of this release.',
			}),
		};
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "areas:intersects"
	) {
		const raw = parsedUrl.searchParams.get("bbox");
		const parts = (raw ?? "").split(",").map((part) => Number(part.trim()));
		const [west, south, east, north] = parts;
		const geography = parsedUrl.searchParams.get("geography");
		const boundaryRelease = parsedUrl.searchParams.get("release");
		if (
			raw === null ||
			parts.length !== 4 ||
			!parts.every((part) => Number.isFinite(part)) ||
			west! < -180 ||
			east! > 180 ||
			south! < -90 ||
			north! > 90 ||
			west! >= east! ||
			south! >= north! ||
			!geography ||
			!boundaryRelease
		) {
			return problem(
				400,
				"Invalid Query",
				"bbox (west,south,east,north in WGS 84, west < east and south < north), geography and release are required.",
			);
		}
		const requestedTier = parsedUrl.searchParams.get("tier");
		if (requestedTier !== null && !isGeometryTier(requestedTier)) {
			return problem(
				400,
				"Unknown Tier",
				`No such generalisation tier: ${requestedTier}. Choose one of ${Object.keys(
					GEOMETRY_TIERS,
				).join(", ")}.`,
			);
		}
		const limitParameter = parsedUrl.searchParams.get("limit");
		const limit =
			limitParameter === null
				? DEFAULT_INTERSECTS_LIMIT
				: Number(limitParameter);
		if (
			!Number.isInteger(limit) ||
			limit < 1 ||
			limit > MAX_INTERSECTS_LIMIT
		) {
			return problem(
				400,
				"Invalid Query",
				`limit must be a whole number from 1 to ${MAX_INTERSECTS_LIMIT}.`,
			);
		}
		if (!areaLookup || !areaGeometryCache) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the area inventory and geometry source registry before box lookup.",
			);
		}
		if (!areaLookup.has(`${geography}/${boundaryRelease}`)) {
			return problem(
				404,
				"Not Found",
				"No compiled area release matches the requested geography and release.",
			);
		}
		try {
			const found = areaGeometryCache.findIntersecting(
				geography,
				boundaryRelease,
				[west!, south!, east!, north!],
			);
			const matches = found.slice(0, limit).flatMap((match) => {
				const area = findArea(
					areaLookup,
					geography,
					boundaryRelease,
					match.code,
				);
				if (!area) return [];
				const simplified =
					requestedTier === null
						? undefined
						: simplifyGeometry(
								areaGeometryCache.get(
									geography,
									boundaryRelease,
									match.code,
								)!,
								requestedTier,
							);
				return [
					{
						id: `${geography}/${boundaryRelease}/${match.code}`,
						...area,
						relation: match.relation,
						boundingBox: match.bounds,
						geometrySource: areaGeometryCache.provenance(
							geography,
							boundaryRelease,
							match.code,
						),
						...(simplified
							? {
									generalisation: {
										vertices: simplified.verticesAfter,
										verticesAtFullResolution:
											simplified.verticesBefore,
										parts: simplified.partsAfter,
										partsAtFullResolution:
											simplified.partsBefore,
									},
									geometry: simplified.geometry,
								}
							: {}),
					},
				];
			});
			return {
				status: 200,
				body: envelope(releaseId, {
					bbox: [west!, south!, east!, north!],
					geography,
					boundaryRelease,
					matched: found.length,
					returned: matches.length,
					limit,
					truncated: found.length > limit,
					relationRule:
						"within when the area lies entirely inside the box, overlaps when it meets the box without being contained by it. Both are exact: an area is tested against the box itself, not against its bounding box.",
					...(requestedTier === null
						? {
								geometry:
									"Not included. Pass tier to receive it, at the cost of the coordinates.",
							}
						: {
								tier: requestedTier,
								toleranceM: GEOMETRY_TIERS[requestedTier],
								minEffectiveAreaM2:
									GEOMETRY_TIERS[requestedTier] ** 2,
								...(requestedTier === "full"
									? {}
									: {
											generalisationMethod:
												GENERALISATION_METHOD,
										}),
							}),
					matches,
				}),
			};
		} catch (error) {
			return problem(
				503,
				"Geometry Unavailable",
				error instanceof Error
					? error.message
					: "Geometry could not be loaded for box lookup.",
			);
		}
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "translations"
	) {
		if (!crosswalkLookup) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the crosswalk inventory before translating area codes.",
			);
		}
		const source = {
			geography: parsedUrl.searchParams.get("sourceGeography"),
			boundaryRelease: parsedUrl.searchParams.get("sourceRelease"),
			code: parsedUrl.searchParams.get("code"),
		};
		const target = {
			geography: parsedUrl.searchParams.get("targetGeography"),
			boundaryRelease: parsedUrl.searchParams.get("targetRelease"),
		};
		const purpose = parsedUrl.searchParams.get("purpose") ?? "membership";
		if (
			!source.geography ||
			!source.boundaryRelease ||
			!source.code ||
			!target.geography ||
			!target.boundaryRelease ||
			!["identity", "membership", "apportion"].includes(purpose)
		) {
			return problem(
				400,
				"Invalid Query",
				"sourceGeography, sourceRelease, code, targetGeography and targetRelease are required; purpose must be identity, membership or apportion.",
			);
		}
		const matches = [...crosswalkLookup.values()].flatMap((crosswalk) => {
			const validForPurpose =
				(purpose === "identity" &&
					crosswalk.method === "official-lookup") ||
				(purpose === "membership" &&
					crosswalk.method === "clean-containment") ||
				(purpose === "apportion" &&
					crosswalk.method === "area-overlap");
			if (!validForPurpose) return [];
			const crosswalkSummary = {
				id: crosswalk.id,
				method: crosswalk.method,
				quality: crosswalk.quality,
				weighting: crosswalk.weighting,
				provenance: crosswalk.provenance,
			};
			if (
				crosswalk.from.geography === source.geography &&
				crosswalk.from.boundaryRelease === source.boundaryRelease &&
				crosswalk.to.geography === target.geography &&
				crosswalk.to.boundaryRelease === target.boundaryRelease
			) {
				const record = crosswalk.records.find(
					(candidate) => candidate.source.code === source.code,
				);
				return record
					? [
							{
								crosswalk: {
									...crosswalkSummary,
									direction: "forward",
								},
								source: record.source,
								targets: record.targets,
							},
						]
					: [];
			}
			if (
				crosswalk.to.geography !== source.geography ||
				crosswalk.to.boundaryRelease !== source.boundaryRelease ||
				crosswalk.from.geography !== target.geography ||
				crosswalk.from.boundaryRelease !== target.boundaryRelease
			)
				return [];
			if (crosswalk.method === "area-overlap") {
				const reverseRecords = crosswalk.records.flatMap((record) => {
					const matchedTarget = record.targets.find(
						(candidate) => candidate.code === source.code,
					);
					return matchedTarget ? [{ record, matchedTarget }] : [];
				});
				if (reverseRecords.length === 0) return [];
				const reverseSource = {
					code: source.code,
					labels: [
						...new Set(
							reverseRecords.flatMap(
								({ matchedTarget }) => matchedTarget.labels,
							),
						),
					].sort(),
				};
				const coverage = reverseRecords.reduce(
					(sum, { matchedTarget }) => sum + matchedTarget.targetShare,
					0,
				);
				return coverage > 0
					? [
							{
								crosswalk: {
									...crosswalkSummary,
									direction: "reverse",
								},
								source: reverseSource,
								sourceCoverage: coverage,
								targets: reverseRecords.map(
									({ record, matchedTarget }) => ({
										...record.source,
										weight:
											matchedTarget.targetShare /
											coverage,
										overlapAreaM2:
											matchedTarget.overlapAreaM2,
										// These shares are expressed against the reversed direction.
										sourceShare: matchedTarget.targetShare,
										targetShare: matchedTarget.sourceShare,
									}),
								),
							},
						]
					: [];
			}
			const reverseRecords = crosswalk.records.flatMap((record) => {
				const matchedTarget = record.targets.find(
					(candidate) => candidate.code === source.code,
				);
				return matchedTarget ? [{ record, matchedTarget }] : [];
			});
			if (reverseRecords.length === 0) return [];
			const reverseSource = {
				code: source.code,
				labels: [
					...new Set(
						reverseRecords.flatMap(
							({ matchedTarget }) => matchedTarget.labels,
						),
					),
				].sort(),
			};
			return [
				{
					crosswalk: { ...crosswalkSummary, direction: "reverse" },
					source: reverseSource,
					targets: reverseRecords.map(({ record }) => record.source),
				},
			];
		});
		return matches.length > 0
			? {
					status: 200,
					body: envelope(releaseId, {
						source,
						target,
						purpose,
						matches,
					}),
				}
			: problem(
					422,
					"Conversion Unavailable",
					"No published crosswalk supports this source, target and purpose. Same codes across releases are not treated as proof of geographic identity.",
				);
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "locations"
	) {
		if (!namedLocationInventory) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the named location inventory before listing locations.",
			);
		}
		const query = parsedUrl.searchParams
			.get("q")
			?.trim()
			.toLocaleLowerCase();
		const locations = namedLocationInventory.locations.filter(
			(location) =>
				!query ||
				location.id.startsWith(query) ||
				location.label.toLocaleLowerCase().startsWith(query),
		);
		return { status: 200, body: envelope(releaseId, locations) };
	}

	if (
		segments.length === 3 &&
		segments[0] === "v1" &&
		segments[1] === "locations"
	) {
		const location = namedLocationLookup?.get(segments[2] as string);
		return location
			? { status: 200, body: envelope(releaseId, location) }
			: problem(
					404,
					"Not Found",
					"No named location matches that identity.",
				);
	}

	if (
		segments.length === 4 &&
		segments[0] === "v1" &&
		segments[1] === "locations" &&
		segments[3] === "members"
	) {
		const location = namedLocationLookup?.get(segments[2] as string);
		if (!location) {
			return problem(
				404,
				"Not Found",
				"No named location matches that identity.",
			);
		}
		const geography =
			parsedUrl.searchParams.get("geography") ?? "localAuthority";
		const boundaryRelease = parsedUrl.searchParams.get("release");
		if (!boundaryRelease) {
			return problem(
				400,
				"Invalid Query",
				"release is required to resolve a named location's members.",
			);
		}
		const areas = areaLookup?.get(`${geography}/${boundaryRelease}`);
		if (!areaLookup || !areas) {
			return problem(
				404,
				"Not Found",
				"No compiled area release matches the requested member geography and release.",
			);
		}

		/*
		 * A location is curated as a list of local authority codes, so any
		 * other geography has to be reached through a published crosswalk. The
		 * caller names which, as everywhere else here: two crosswalks can join
		 * the same pair of releases by different methods, and the one chosen
		 * decides whether membership means wholly inside or partly overlapping.
		 * Asking without naming one is answered with the list to choose from.
		 */
		if (geography !== MEMBER_GEOGRAPHY) {
			if (!crosswalkInventory || !crosswalkLookup) {
				return problem(
					503,
					"Catalogue Unavailable",
					"Build the crosswalk inventory before resolving a named location into another geography.",
				);
			}
			const candidates = crosswalksTo(
				crosswalkInventory,
				geography,
				boundaryRelease,
				MEMBER_GEOGRAPHY,
			);
			const requested = parsedUrl.searchParams.get("via");
			if (!requested) {
				return problem(
					400,
					"Invalid Query",
					candidates.length === 0
						? `A named location is curated as ${MEMBER_GEOGRAPHY} codes, and no published crosswalk maps ${geography}/${boundaryRelease} to a ${MEMBER_GEOGRAPHY} release, so its members cannot be resolved there.`
						: `Name the crosswalk to resolve members through, with via=. Published for ${geography}/${boundaryRelease}: ${candidates
								.map(
									(candidate) =>
										`${candidate.id} (${candidate.method}, to ${candidate.to.boundaryRelease})`,
								)
								.join("; ")}.`,
				);
			}
			const summary = candidates.find(
				(candidate) => candidate.id === requested,
			);
			const crosswalk = summary
				? crosswalkLookup.get(requested)
				: undefined;
			if (!summary || !crosswalk) {
				return problem(
					404,
					"Not Found",
					`No published crosswalk ${requested} maps ${geography}/${boundaryRelease} to a ${MEMBER_GEOGRAPHY} release.`,
				);
			}
			// The location's own codes are resolved against the release the
			// crosswalk ends at, not the one the caller asked for, which
			// belongs to the geography being resolved into.
			const parentRelease = crosswalk.to.boundaryRelease;
			const parents =
				areaLookup.get(`${MEMBER_GEOGRAPHY}/${parentRelease}`) ??
				new Map();
			const parentCodes = new Set(
				location.memberCodes.filter((code) => parents.has(code)),
			);
			const coverage = reconcileMembers(
				areaLookup,
				MEMBER_GEOGRAPHY,
				parentRelease,
				location.memberCodes,
				parentCodes,
			);
			const traversed = membersThroughCrosswalk(crosswalk, parentCodes);
			const kind = membershipKindFor(crosswalk);
			return {
				status: 200,
				body: envelope(releaseId, {
					location,
					geography,
					boundaryRelease,
					membership: kind,
					membershipNote:
						kind === "fully-contained"
							? "Each area is placed wholly inside one member by the publisher's own lookup, so membership is exact and no area is counted in part."
							: "Areas are matched by area overlap. One straddling the edge of the location is returned with the share of it that lies inside, and marked partial; it is not a whole member of this location.",
					via: {
						id: crosswalk.id,
						method: crosswalk.method,
						quality: crosswalk.quality,
						weighting: crosswalk.weighting,
						from: crosswalk.from,
						to: crosswalk.to,
						contentHash: summary.contentHash,
					},
					members: traversed.map((member) => ({
						id: `${geography}/${boundaryRelease}/${member.code}`,
						code: member.code,
						...(areas.get(member.code) ?? {
							name: member.labels[0] ?? member.code,
						}),
						through: {
							id: `${MEMBER_GEOGRAPHY}/${parentRelease}/${member.throughCode}`,
							code: member.throughCode,
						},
						...(member.weight === undefined
							? {}
							: { weight: member.weight }),
						...(member.partial ? { partial: true } : {}),
					})),
					partialMembers: traversed.filter((member) => member.partial)
						.length,
					// How the location's own codes resolved in the release the
					// crosswalk starts from, which is what the traversal saw.
					parentGeography: MEMBER_GEOGRAPHY,
					parentBoundaryRelease: parentRelease,
					coverage,
				}),
			};
		}

		const members = location.memberCodes.flatMap((code) => {
			const area = areas.get(code);
			return area
				? [{ id: `${geography}/${boundaryRelease}/${code}`, ...area }]
				: [];
		});
		const resolvedCodes = new Set(members.map((member) => member.code));
		return {
			status: 200,
			body: envelope(releaseId, {
				location,
				geography,
				boundaryRelease,
				membership: "direct-code-match",
				members,
				unresolvedMemberCodes: location.memberCodes.filter(
					(code) => !resolvedCodes.has(code),
				),
				coverage: reconcileMembers(
					areaLookup,
					geography,
					boundaryRelease,
					location.memberCodes,
					resolvedCodes,
				),
			}),
		};
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
		segments.length === 6 &&
		segments[0] === "v1" &&
		segments[1] === "areas" &&
		segments[5] === "history"
	) {
		const [geography, boundaryRelease, code] = segments.slice(2, 5) as [
			string,
			string,
			string,
		];
		const area = findArea(areaLookup, geography, boundaryRelease, code);
		if (!area) {
			return areaNotFound(geography, boundaryRelease, code);
		}
		const sameCodeReleases = searchableAreas(areaLookup ?? new Map())
			.filter(
				(candidate) =>
					candidate.geography === geography &&
					candidate.code === code &&
					candidate.boundaryRelease !== boundaryRelease,
			)
			.map((candidate) => ({
				...candidate,
				status: "same-code-continuity" as const,
			}))
			.sort((left, right) =>
				left.boundaryRelease.localeCompare(right.boundaryRelease),
			);
		const relationships = relationshipsFor(
			areaRelationshipIndex,
			crosswalkLookup,
			geography,
			boundaryRelease,
			code,
		).filter(
			(relationship) =>
				relationship.relation === "successor" ||
				relationship.relation === "predecessor",
		);
		return {
			status: 200,
			body: envelope(releaseId, {
				id: `${geography}/${boundaryRelease}/${code}`,
				geography,
				boundaryRelease,
				...area,
				relationships,
				sameCodeReleases,
				note: "Same-code continuity only reports that the identifier appears in another release; it does not assert unchanged geometry or an exact historical equivalent.",
			}),
		};
	}

	if (
		segments.length === 6 &&
		segments[0] === "v1" &&
		segments[1] === "areas" &&
		(segments[5] === "parents" || segments[5] === "children")
	) {
		const [geography, boundaryRelease, code] = segments.slice(2, 5) as [
			string,
			string,
			string,
		];
		const area = findArea(areaLookup, geography, boundaryRelease, code);
		if (!area) {
			return areaNotFound(geography, boundaryRelease, code);
		}
		if (!crosswalkLookup) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the crosswalk inventory before looking up area membership.",
			);
		}
		const relation = segments[5] === "parents" ? "within" : "contains";
		const relationships = relationshipsFor(
			areaRelationshipIndex,
			crosswalkLookup,
			geography,
			boundaryRelease,
			code,
		).filter((relationship) => relationship.relation === relation);
		return {
			status: 200,
			body: envelope(releaseId, {
				id: `${geography}/${boundaryRelease}/${code}`,
				geography,
				boundaryRelease,
				...area,
				relationships,
			}),
		};
	}

	if (
		segments.length === 6 &&
		segments[0] === "v1" &&
		segments[1] === "areas" &&
		segments[5] === "overlap"
	) {
		const [geography, boundaryRelease, code] = segments.slice(2, 5) as [
			string,
			string,
			string,
		];
		const other = (parsedUrl.searchParams.get("with") ?? "").split("/");
		if (other.length !== 3 || other.some((part) => part.length === 0)) {
			return problem(
				400,
				"Invalid Query",
				"with must name the other area as {type}/{release}/{code}, such as localAuthority/2024-05-uk-bgc/E07000092.",
			);
		}
		const [otherGeography, otherRelease, otherCode] = other as [
			string,
			string,
			string,
		];
		const area = findArea(areaLookup, geography, boundaryRelease, code);
		if (!area) return areaNotFound(geography, boundaryRelease, code);
		const otherArea = findArea(
			areaLookup,
			otherGeography,
			otherRelease,
			otherCode,
		);
		if (!otherArea)
			return areaNotFound(otherGeography, otherRelease, otherCode);
		if (!areaGeometryCache)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the geometry source registry before measuring an overlap.",
			);
		try {
			const geometry = areaGeometryCache.get(
				geography,
				boundaryRelease,
				code,
			);
			const otherGeometry = areaGeometryCache.get(
				otherGeography,
				otherRelease,
				otherCode,
			);
			if (!geometry || !otherGeometry)
				return problem(
					404,
					"Not Found",
					`No raw geometry matches ${geometry ? `${otherGeography}/${otherRelease}/${otherCode}` : `${geography}/${boundaryRelease}/${code}`}.`,
				);
			const measured = measurePairOverlap(
				geometry,
				otherGeometry,
				PAIR_OVERLAP_RULES,
			);
			const otherId = `${otherGeography}/${otherRelease}/${otherCode}`;
			const round = (value: number) => Math.round(value * 1e6) / 1e6;
			return {
				status: 200,
				body: envelope(releaseId, {
					first: {
						id: `${geography}/${boundaryRelease}/${code}`,
						geography,
						boundaryRelease,
						...area,
						areaM2: Math.round(measured.firstAreaM2),
						geometry: areaGeometryCache.provenance(
							geography,
							boundaryRelease,
							code,
						),
					},
					second: {
						id: otherId,
						geography: otherGeography,
						boundaryRelease: otherRelease,
						...otherArea,
						areaM2: Math.round(measured.secondAreaM2),
						geometry: areaGeometryCache.provenance(
							otherGeography,
							otherRelease,
							otherCode,
						),
					},
					relation: measured.relation,
					overlap: {
						areaM2: Math.round(measured.overlapAreaM2),
						shareOfFirst: round(measured.shareOfFirst),
						shareOfSecond: round(measured.shareOfSecond),
						pieceCount: measured.pieceCount,
						widestPieceWidthM:
							measured.widestPieceWidthM === null
								? null
								: Math.round(measured.widestPieceWidthM * 10) /
									10,
					},
					publishedRelationships: relationshipsFor(
						areaRelationshipIndex,
						crosswalkLookup,
						geography,
						boundaryRelease,
						code,
					)
						.filter(
							(relationship) =>
								relationship.counterpart.id === otherId,
						)
						.map((relationship) => ({
							relation: relationship.relation,
							crosswalk: {
								...relationship.crosswalk,
								href: `/v1/crosswalks/${relationship.crosswalk.id}`,
							},
							...(relationship.overlap
								? { overlap: relationship.overlap }
								: {}),
						})),
					method: PAIR_OVERLAP_METHOD,
				}),
			};
		} catch (error) {
			return problem(
				503,
				"Geometry Unavailable",
				error instanceof Error
					? error.message
					: "Geometry could not be loaded to measure an overlap.",
			);
		}
	}

	if (
		segments.length === 6 &&
		segments[0] === "v1" &&
		segments[1] === "areas" &&
		segments[5] === "neighbours"
	) {
		const [geography, boundaryRelease, code] = segments.slice(2, 5) as [
			string,
			string,
			string,
		];
		const area = findArea(areaLookup, geography, boundaryRelease, code);
		if (!area) return areaNotFound(geography, boundaryRelease, code);
		if (!areaGeometryCache)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the geometry source registry before finding neighbours.",
			);
		const touches = parsedUrl.searchParams.get("touches") ?? "edge";
		if (touches !== "edge" && touches !== "any")
			return problem(
				400,
				"Invalid Query",
				"touches must be edge, for areas sharing a border, or any, which also returns areas meeting at a single point.",
			);
		try {
			const found = areaGeometryCache.findNeighbours(
				geography,
				boundaryRelease,
				code,
			);
			if (!found)
				return problem(
					404,
					"Not Found",
					"No raw geometry matches that area identity.",
				);
			const geometry = areaGeometryCache.get(
				geography,
				boundaryRelease,
				code,
			)!;
			const metrics = areaMetrics(geometry);
			const kept = found.filter(
				(neighbour) => touches === "any" || neighbour.touch === "edge",
			);
			const sharedBorderM = kept.reduce(
				(total, neighbour) => total + neighbour.sharedBorderM,
				0,
			);
			const perimeterM = metrics?.perimeterM ?? 0;
			return {
				status: 200,
				body: envelope(releaseId, {
					id: `${geography}/${boundaryRelease}/${code}`,
					geography,
					boundaryRelease,
					...area,
					touches,
					border: {
						perimeterM,
						sharedBorderM,
						// A fully landlocked area shares every metre, and
						// summing its neighbours can land a hair over its own
						// perimeter, so the remainder is floored at nothing
						// rather than reported as a negative coastline.
						unsharedBorderM: Math.max(
							0,
							perimeterM - sharedBorderM,
						),
						pointOnlyTouches: found.filter(
							(neighbour) => neighbour.touch === "point",
						).length,
					},
					method: NEIGHBOUR_METHOD,
					neighbours: kept.flatMap((neighbour) => {
						const neighbourArea = findArea(
							areaLookup,
							geography,
							boundaryRelease,
							neighbour.code,
						);
						return [
							{
								id: `${geography}/${boundaryRelease}/${neighbour.code}`,
								...(neighbourArea ?? { code: neighbour.code }),
								touch: neighbour.touch,
								sharedBorderM: neighbour.sharedBorderM,
								shareOfPerimeter:
									perimeterM > 0
										? neighbour.sharedBorderM / perimeterM
										: 0,
								sharedEdges: neighbour.sharedEdges,
								sharedVertices: neighbour.sharedVertices,
							},
						];
					}),
				}),
			};
		} catch (error) {
			return problem(
				503,
				"Geometry Unavailable",
				error instanceof Error
					? error.message
					: "Geometry could not be loaded for neighbour lookup.",
			);
		}
	}

	if (
		segments.length === 7 &&
		segments[0] === "v1" &&
		segments[1] === "areas" &&
		segments[5] === "children" &&
		segments[6] === "geometry"
	) {
		const [geography, boundaryRelease, code] = segments.slice(2, 5) as [
			string,
			string,
			string,
		];
		const area = findArea(areaLookup, geography, boundaryRelease, code);
		if (!area) return areaNotFound(geography, boundaryRelease, code);
		if (!crosswalkLookup)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the crosswalk inventory before looking up area membership.",
			);
		if (!areaGeometryCache)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the geometry source registry before retrieving geometry.",
			);
		const requestedTier = parsedUrl.searchParams.get("tier") ?? "full";
		if (!isGeometryTier(requestedTier))
			return problem(
				400,
				"Unknown Tier",
				`No such generalisation tier: ${requestedTier}. Choose one of ${Object.keys(
					GEOMETRY_TIERS,
				).join(", ")}.`,
			);
		const children = relationshipsFor(
			areaRelationshipIndex,
			crosswalkLookup,
			geography,
			boundaryRelease,
			code,
		).filter((relationship) => relationship.relation === "contains");
		if (children.length === 0)
			return problem(
				404,
				"Not Found",
				"No published relationship names anything as contained by that area.",
			);
		const features: unknown[] = [];
		// A child can be published as a relationship and still have no servable
		// geometry, and a whole release can be missing its geometry source.
		// Both are listed rather than passed over, so a caller can tell a
		// partial collection from a complete one.
		const withoutGeometry: unknown[] = [];
		let vertices = 0;
		for (const child of children) {
			const { counterpart, crosswalk } = child;
			const note = (reason: string) => {
				withoutGeometry.push({
					id: counterpart.id,
					geography: counterpart.geography,
					boundaryRelease: counterpart.boundaryRelease,
					code: counterpart.code,
					reason,
				});
			};
			let geometry;
			try {
				geometry = areaGeometryCache.get(
					counterpart.geography,
					counterpart.boundaryRelease,
					counterpart.code,
				);
			} catch (error) {
				note(
					error instanceof Error
						? error.message
						: "Geometry could not be loaded.",
				);
				continue;
			}
			if (!geometry) {
				note("No feature for this code in the raw geometry source.");
				continue;
			}
			const simplified = simplifyGeometry(geometry, requestedTier);
			if (!simplified) {
				note(
					`Every part is smaller than the ${requestedTier} tier keeps.`,
				);
				continue;
			}
			vertices += simplified.verticesAfter;
			const childArea = findArea(
				areaLookup,
				counterpart.geography,
				counterpart.boundaryRelease,
				counterpart.code,
			);
			features.push({
				type: "Feature",
				id: counterpart.id,
				properties: {
					id: counterpart.id,
					geography: counterpart.geography,
					boundaryRelease: counterpart.boundaryRelease,
					code: counterpart.code,
					...(childArea ?? { labels: counterpart.labels }),
					// Membership here is a published crosswalk's claim, not a
					// geometric test run at request time.
					membership: crosswalk,
					// The tier itself is stated once for the collection; only
					// what it cost this member is worth repeating, so that a
					// member which lost parts can be told from one that did not.
					generalisation: {
						vertices: simplified.verticesAfter,
						verticesAtFullResolution: simplified.verticesBefore,
						parts: simplified.partsAfter,
						partsAtFullResolution: simplified.partsBefore,
					},
					geometrySource: areaGeometryCache.provenance(
						counterpart.geography,
						counterpart.boundaryRelease,
						counterpart.code,
					),
				},
				geometry: simplified.geometry,
			});
		}
		return {
			status: 200,
			body: envelope(releaseId, {
				type: "FeatureCollection",
				id: `${geography}/${boundaryRelease}/${code}/children`,
				parent: {
					id: `${geography}/${boundaryRelease}/${code}`,
					geography,
					boundaryRelease,
					...area,
				},
				collection: {
					members: children.length,
					withGeometry: features.length,
					vertices,
					tier: requestedTier,
					toleranceM: GEOMETRY_TIERS[requestedTier],
					minEffectiveAreaM2: GEOMETRY_TIERS[requestedTier] ** 2,
					...(requestedTier === "full"
						? {}
						: { generalisationMethod: GENERALISATION_METHOD }),
				},
				withoutGeometry,
				features,
			}),
		};
	}

	if (
		segments.length === 7 &&
		segments[0] === "v1" &&
		segments[1] === "areas" &&
		segments[5] === "geometry" &&
		segments[6] === "metadata"
	) {
		const [geography, boundaryRelease, code] = segments.slice(2, 5);
		const area = findArea(
			areaLookup,
			geography as string,
			boundaryRelease as string,
			code as string,
		);
		if (!area) return areaNotFound(geography, boundaryRelease, code);
		if (!areaGeometryCache)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the geometry source registry before retrieving geometry.",
			);
		try {
			const geometry = areaGeometryCache.get(
				geography as string,
				boundaryRelease as string,
				code as string,
			);
			if (!geometry)
				return problem(
					404,
					"Not Found",
					"No raw geometry matches that area identity.",
				);
			const metrics = areaMetrics(geometry);
			if (!metrics)
				return problem(
					422,
					"Geometry Not Measurable",
					"That area's geometry carries no polygon to measure.",
				);
			return {
				status: 200,
				body: envelope(releaseId, {
					id: [geography, boundaryRelease, area.code].join("/"),
					geography,
					boundaryRelease,
					...area,
					boundingBox: metrics.boundingBox,
					centroid: metrics.centroid,
					labelPoint: metrics.labelPoint,
					labelPointMethod: metrics.labelPointMethod,
					area: {
						m2: metrics.areaM2,
						hectares: metrics.areaHectares,
						km2: metrics.areaKm2,
					},
					perimeter: {
						m: metrics.perimeterM,
						km: metrics.perimeterKm,
					},
					geometryExtent: {
						parts: metrics.parts,
						rings: metrics.rings,
						vertices: metrics.vertices,
					},
					method: AREA_METRIC_METHOD,
					geometrySource: areaGeometryCache.provenance(
						geography as string,
						boundaryRelease as string,
						code as string,
					),
				}),
			};
		} catch (error) {
			return problem(
				503,
				"Geometry Unavailable",
				error instanceof Error
					? error.message
					: "Geometry could not be loaded.",
			);
		}
	}

	if (
		segments.length === 6 &&
		segments[0] === "v1" &&
		segments[1] === "areas" &&
		segments[5] === "geometry"
	) {
		const [geography, boundaryRelease, code] = segments.slice(2, 5);
		const area = findArea(
			areaLookup,
			geography as string,
			boundaryRelease as string,
			code as string,
		);
		if (!area) return areaNotFound(geography, boundaryRelease, code);
		if (!areaGeometryCache)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the geometry source registry before retrieving geometry.",
			);
		try {
			const geometry = areaGeometryCache.get(
				geography as string,
				boundaryRelease as string,
				code as string,
			);
			if (!geometry)
				return problem(
					404,
					"Not Found",
					"No raw geometry matches that area identity.",
				);
			const requestedTier = parsedUrl.searchParams.get("tier") ?? "full";
			if (!isGeometryTier(requestedTier))
				return problem(
					400,
					"Unknown Tier",
					`No such generalisation tier: ${requestedTier}. Choose one of ${Object.keys(
						GEOMETRY_TIERS,
					).join(", ")}.`,
				);
			const simplified = simplifyGeometry(geometry, requestedTier);
			if (!simplified)
				return problem(
					404,
					"Not Found",
					`Every part of that area is smaller than the ${requestedTier} tier keeps. Ask for a finer tier.`,
				);
			return {
				status: 200,
				body: envelope(releaseId, {
					type: "Feature",
					id: [geography, boundaryRelease, code].join("/"),
					properties: {
						id: [geography, boundaryRelease, area.code].join("/"),
						geography,
						boundaryRelease,
						...area,
						generalisation: {
							tier: simplified.tier,
							toleranceM: simplified.toleranceM,
							minEffectiveAreaM2: simplified.minEffectiveAreaM2,
							vertices: simplified.verticesAfter,
							verticesAtFullResolution: simplified.verticesBefore,
							parts: simplified.partsAfter,
							partsAtFullResolution: simplified.partsBefore,
							...(requestedTier === "full"
								? {}
								: { method: GENERALISATION_METHOD }),
						},
						geometrySource: areaGeometryCache.provenance(
							geography as string,
							boundaryRelease as string,
							code as string,
						),
					},
					geometry: simplified.geometry,
				}),
			};
		} catch (error) {
			return problem(
				503,
				"Geometry Unavailable",
				error instanceof Error
					? error.message
					: "Geometry could not be loaded.",
			);
		}
	}

	if (
		segments.length === 6 &&
		segments[0] === "v1" &&
		segments[1] === "areas" &&
		segments[5] === "citation"
	) {
		const [geography, boundaryRelease, code] = segments.slice(2, 5) as [
			string,
			string,
			string,
		];
		const area = findArea(areaLookup, geography, boundaryRelease, code);
		if (!area) return areaNotFound(geography, boundaryRelease, code);
		if (!dataCatalog || !crosswalkInventory) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the data catalogue and crosswalk inventory before citing an area.",
			);
		}
		const measureIds = [
			...new Set(parsedUrl.searchParams.getAll("measure")),
		];
		const crosswalkIds = [
			...new Set(parsedUrl.searchParams.getAll("crosswalk")),
		];
		const releaseIdentity = `${geography}/${boundaryRelease}`;
		// Resolved here only to refuse unknown resources; the bundle's own
		// attribution is narrowed below to what this area actually draws on.
		const requested = attributionFor(
			{
				datasets: [],
				measures: measureIds,
				boundaryReleases: [releaseIdentity],
				crosswalks: crosswalkIds,
			},
			dataCatalog,
			registry,
			crosswalkInventory,
		);
		if (requested.status === "unknown") {
			return problem(
				404,
				"Not Found",
				`No published resource matches ${requested.unknownResources.join(", ")}.`,
			);
		}

		// A crosswalk is cited for an area only when it maps that area; citing
		// one that does not would lend it evidence it never supplied.
		const relationships = relationshipsFor(
			areaRelationshipIndex,
			crosswalkLookup,
			geography,
			boundaryRelease,
			code,
		);
		const unrelatedCrosswalks = crosswalkIds.filter(
			(id) =>
				!relationships.some(
					(relationship) => relationship.crosswalk.id === id,
				),
		);
		if (unrelatedCrosswalks.length > 0) {
			return problem(
				422,
				"Not Applicable To Area",
				`${unrelatedCrosswalks.map((id) => `crosswalk=${id}`).join(", ")} publishes no relationship for ${releaseIdentity}/${code}.`,
			);
		}

		// Likewise a measure is cited through the observation artifacts that
		// actually hold a value for this area, in partitions assessed against
		// this exact release.
		const measures = measureIds.map((measureId) => {
			const measure = dataCatalog.measures.find(
				(candidate) => candidate.id === measureId,
			) as DataCatalog["measures"][number];
			const coverage = measureCompatibilityInventory
				? measureCoverage(
						dataCatalog,
						measureCompatibilityInventory,
						measureId,
					)
				: undefined;
			const sources = areaMeasureSources(
				measure,
				coverage,
				boundaryRelease,
				code,
				{
					populationObservations,
					populationLocalAuthorityObservations,
					measureObservations,
				},
			).flatMap((source) => {
				const periods = source.periods.flatMap((period) =>
					period.availability === "present"
						? [
								{
									period: period.period,
									artifact: period.artifact,
									contentHash: period.contentHash,
									status: period.status,
								},
							]
						: [],
				);
				return periods.length > 0
					? [
							{
								dataset: source.dataset,
								sourceGeography: source.sourceGeography,
								codeSetCompatibility: {
									status: source.codeSetCompatibility.status,
									eligibleForCodeJoin:
										source.codeSetCompatibility
											.eligibleForCodeJoin,
								},
								periods,
							},
						]
					: [];
			});
			return {
				id: measure.id,
				label: measure.label,
				href: `/v1/measures/${measure.id}`,
				sources,
			};
		});
		const uncitedMeasures = measures.filter(
			(measure) => measure.sources.length === 0,
		);
		if (uncitedMeasures.length > 0) {
			return problem(
				422,
				"Not Applicable To Area",
				`${uncitedMeasures.map((measure) => `measure=${measure.id}`).join(", ")} publishes no observation for ${releaseIdentity}/${code} in a source assessed against this boundary release.`,
			);
		}

		// A measure's other partitions hold no value for this area, so only the
		// datasets cited above are credited, with any derived measure's
		// denominator, which is as much a part of the value.
		const attribution = attributionFor(
			{
				datasets: [
					...measures.flatMap((measure) =>
						measure.sources.map((source) => source.dataset.id),
					),
					...measureIds.flatMap(
						(id) =>
							dataCatalog.measures.find(
								(candidate) => candidate.id === id,
							)?.derivedFrom?.datasetIds ?? [],
					),
				],
				measures: [],
				boundaryReleases: [releaseIdentity],
				crosswalks: crosswalkIds,
			},
			dataCatalog,
			registry,
			crosswalkInventory,
		);
		if (attribution.status === "unknown") {
			return problem(
				404,
				"Not Found",
				`No published resource matches ${attribution.unknownResources.join(", ")}.`,
			);
		}

		const release = registry.releases.find(
			(candidate) =>
				candidate.geography === geography &&
				candidate.id === boundaryRelease,
		) as BoundaryRegistry["releases"][number];
		const identityArtifact = areaInventory?.releases.find(
			(candidate) =>
				candidate.geography === geography &&
				candidate.id === boundaryRelease,
		);
		const geometryHref = `/v1/areas/${geography}/${boundaryRelease}/${code}/geometry`;
		const geometryHash = (inputHash?: string) =>
			inputHash
				? {
						status: "available" as const,
						scope: "source-file" as const,
						value: inputHash,
						note: "Hashes the whole source file this release's geometry is read from, not this area alone. Per-area geometry hashes are not compiled.",
					}
				: {
						status: "not-published" as const,
						note: "No hash of the geometry source is recorded for this release. The boundary release's metadataHash pins its metadata, which names the source file but does not hash its contents.",
					};
		const geometry = (() => {
			if (!areaGeometryCache)
				return {
					status: "not-published" as const,
					href: geometryHref,
					hash: geometryHash(),
				};
			try {
				const provenance = areaGeometryCache.get(
					geography,
					boundaryRelease,
					code,
				)
					? areaGeometryCache.provenance(
							geography,
							boundaryRelease,
							code,
						)
					: undefined;
				return provenance
					? {
							status: "available" as const,
							href: geometryHref,
							provenance,
							hash: geometryHash(provenance.inputHash),
						}
					: {
							status: "not-found" as const,
							href: geometryHref,
							hash: geometryHash(),
						};
			} catch (error) {
				return {
					status: "unavailable" as const,
					href: geometryHref,
					reason:
						error instanceof Error
							? error.message
							: "Geometry could not be loaded.",
					hash: geometryHash(),
				};
			}
		})();

		const crosswalks = crosswalkIds.map((id) => {
			const entry = crosswalkInventory.crosswalks.find(
				(candidate) => candidate.id === id,
			) as CrosswalkInventory["crosswalks"][number];
			const artifact = crosswalkLookup?.get(id);
			return {
				id,
				method: entry.method,
				quality: entry.quality,
				from: entry.from,
				to: entry.to,
				contentHash: entry.contentHash,
				...(artifact ? { provenance: artifact.provenance } : {}),
				href: `/v1/crosswalks/${id}`,
			};
		});

		const validationIds = [
			"atlas",
			`boundary-releases/${releaseIdentity}`,
			...crosswalkIds.map((id) => `crosswalks/${id}`),
		];
		const validation = validationReport
			? {
					status: "available" as const,
					reportHash: validationReport.contentHash,
					resources: validationIds.map((id) => {
						const resource = validationReport.resources.find(
							(candidate) => candidate.id === id,
						);
						const href =
							id === "atlas"
								? "/v1/validation"
								: `/v1/validation/${id}`;
						return resource
							? { ...resource, href }
							: { id, status: "not-validated" as const };
					}),
				}
			: { status: "not-published" as const };

		return {
			status: 200,
			body: envelope(releaseId, {
				id: `${releaseIdentity}/${code}`,
				geography,
				boundaryRelease,
				...area,
				atlasRelease: atlasRelease
					? {
							id: releaseId,
							href: `/v1/atlas-releases/${releaseId}`,
						}
					: { id: releaseId, status: "not-published" as const },
				identity: identityArtifact
					? identityArtifact.status === "available"
						? {
								status: "available" as const,
								artifact: identityArtifact.artifact,
								contentHash: identityArtifact.contentHash,
								...(identityArtifact.derivedFrom
									? {
											derivedFrom:
												identityArtifact.derivedFrom,
										}
									: {}),
							}
						: {
								status: identityArtifact.status,
								reason: identityArtifact.reason,
							}
					: { status: "not-published" as const },
				boundary: {
					id: releaseIdentity,
					title: release.title,
					publisher: release.source.publisher,
					sourceUrl: release.source.url,
					...(release.source.retrievedAt
						? { retrievedAt: release.source.retrievedAt }
						: {}),
					licence: release.source.licence,
					metadataHash: release.metadataHash,
					href: `/v1/boundary-releases/${releaseIdentity}`,
				},
				geometry,
				measures,
				crosswalks,
				validation,
				resources: attribution.resources,
				licences: attribution.licences,
				text: attributionText(
					attribution.resources,
					attribution.licences,
					releaseId,
				),
				note: "Hashes pin the artifacts this Atlas release serves for the area. Licence names are reproduced as the publisher states them and are not interpreted here.",
			}),
		};
	}

	if (
		segments.length === 6 &&
		segments[0] === "v1" &&
		segments[1] === "areas" &&
		segments[5] === "capabilities"
	) {
		const [geography, boundaryRelease, code] = segments.slice(2, 5) as [
			string,
			string,
			string,
		];
		const area = findArea(areaLookup, geography, boundaryRelease, code);
		if (!area) return areaNotFound(geography, boundaryRelease, code);
		const geometryHref = `/v1/areas/${geography}/${boundaryRelease}/${code}/geometry`;
		const geometry = (() => {
			if (!areaGeometryCache)
				return { status: "not-published" as const, href: geometryHref };
			try {
				return areaGeometryCache.get(geography, boundaryRelease, code)
					? {
							status: "available" as const,
							href: geometryHref,
							provenance: areaGeometryCache.provenance(
								geography,
								boundaryRelease,
								code,
							),
						}
					: { status: "not-found" as const, href: geometryHref };
			} catch (error) {
				return {
					status: "unavailable" as const,
					href: geometryHref,
					reason:
						error instanceof Error
							? error.message
							: "Geometry could not be loaded.",
				};
			}
		})();
		const relationships = crosswalkLookup
			? relationshipsFor(
					areaRelationshipIndex,
					crosswalkLookup,
					geography,
					boundaryRelease,
					code,
				)
			: [];
		const relationCount = (relation: string) =>
			relationships.filter((candidate) => candidate.relation === relation)
				.length;
		const crosswalks = [
			...new Map(
				relationships.map((relationship) => [
					relationship.crosswalk.id,
					relationship.crosswalk,
				]),
			).values(),
		].map((crosswalk) => ({
			...crosswalk,
			href: `/v1/crosswalks/${crosswalk.id}`,
		}));
		const data =
			dataCatalog && measureCompatibilityInventory
				? {
						status: "available" as const,
						measures: dataCatalog.measures.flatMap((measure) => {
							const coverage = measureCoverage(
								dataCatalog,
								measureCompatibilityInventory,
								measure.id,
							);
							const sources = areaMeasureSources(
								measure,
								coverage,
								boundaryRelease,
								code,
								{
									populationObservations,
									populationLocalAuthorityObservations,
									measureObservations,
								},
							);
							return sources.length > 0
								? [
										{
											id: measure.id,
											valueKind: measure.valueKind,
											unit: measure.unit,
											availability: measure.availability,
											href: `/v1/measures/${measure.id}`,
											sources,
										},
									]
								: [];
						}),
						note: "Compatibility compares area-code membership only. It does not assert equal geometry between a source and this boundary release.",
					}
				: { status: "not-published" as const };
		return {
			status: 200,
			body: envelope(releaseId, {
				id: `${geography}/${boundaryRelease}/${code}`,
				geography,
				boundaryRelease,
				...area,
				capabilities: {
					geometry,
					relationships: crosswalkLookup
						? {
								status: "available" as const,
								href: `/v1/areas/${geography}/${boundaryRelease}/${code}/relationships`,
								count: relationships.length,
								byRelation: Object.fromEntries(
									[
										...new Set(
											relationships.map(
												(relationship) =>
													relationship.relation,
											),
										),
									].map((relation) => [
										relation,
										relationCount(relation),
									]),
								),
								parents: {
									count: relationCount("within"),
									href: `/v1/areas/${geography}/${boundaryRelease}/${code}/parents`,
								},
								children: {
									count: relationCount("contains"),
									href: `/v1/areas/${geography}/${boundaryRelease}/${code}/children`,
								},
								crosswalks,
							}
						: { status: "not-published" as const },
					namedLocations: namedLocationInventory
						? {
								status: "available" as const,
								membership: "direct-code-match" as const,
								locations: namedLocationInventory.locations
									.filter((location) =>
										location.memberCodes.includes(code),
									)
									.map((location) => ({
										id: location.id,
										label: location.label,
										href: `/v1/locations/${location.id}/members?geography=${geography}&release=${boundaryRelease}`,
									})),
								note: "Named locations are editorial groupings. Membership is a direct code match and does not assert an official geography or equal geometry.",
							}
						: { status: "not-published" as const },
					data,
				},
			}),
		};
	}

	if (
		segments.length === 6 &&
		segments[0] === "v1" &&
		segments[1] === "areas" &&
		segments[5] === "relationships"
	) {
		const [geography, boundaryRelease, code] = segments.slice(2, 5);
		const area = findArea(
			areaLookup,
			geography as string,
			boundaryRelease as string,
			code as string,
		);
		if (!area) {
			return areaNotFound(geography, boundaryRelease, code);
		}
		if (!crosswalkLookup) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the crosswalk inventory before looking up relationships.",
			);
		}
		const relationships = relationshipsFor(
			areaRelationshipIndex,
			crosswalkLookup,
			geography as string,
			boundaryRelease as string,
			code as string,
		);
		return {
			status: 200,
			body: envelope(releaseId, {
				id: [geography, boundaryRelease, code].join("/"),
				geography,
				boundaryRelease,
				...area,
				relationships,
			}),
		};
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
			: areaNotFound(geography, boundaryRelease, code);
	}

	return problem(404, "Not Found", "No API resource matches that path.");
};
