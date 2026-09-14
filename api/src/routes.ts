import type { AreaLookup } from "./areaInventory";
import type { AreaGeometryCache } from "./areaGeometry";
import {
	createAreaRelationshipIndex,
	type AreaRelationshipIndex,
} from "./areaRelationships";
import type { AtlasRelease } from "./atlasRelease";
import { compareAtlasReleases } from "./atlasReleaseComparison";
import type { BoundaryRegistry } from "./boundaryRegistry";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "./crosswalkInventory";
import type { GeographyInventory } from "./geographyInventory";
import type { RelationshipCandidateInventory } from "./relationshipCandidates";
import type {
	NamedLocationInventory,
	NamedLocationLookup,
} from "./namedLocations";
import type { ValidationReport } from "./validationReport";
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
import type { MeasureCompatibilityInventory } from "./measureCompatibility";
import type { ExportManifest } from "./exportManifest";
import { compareObservations } from "./comparison";
import {
	aggregateCountryMembers,
	aggregateLocationMembers,
	isCountryCode,
} from "./aggregation";
import { convertObservations } from "./conversion";
import { attributionFor, attributionText } from "./attribution";
import { measureCoverage } from "./measureCoverage";
import { reconcileMembers } from "./memberReconciliation";
import { rankObservations, type RankingOrder } from "./ranking";
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
	representation?: {
		contentType: string;
		body: string;
		headers?: Record<string, string>;
	};
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

const findArea = (
	areaLookup: AreaLookup | undefined,
	geography: string,
	boundaryRelease: string,
	code: string,
) => areaLookup?.get(`${geography}/${boundaryRelease}`)?.get(code);

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

export type RouteContext = {
	boundaryRegistry: BoundaryRegistry;
	geographyInventory?: GeographyInventory;
	areaLookup?: AreaLookup;
	crosswalkInventory?: CrosswalkInventory;
	crosswalkLookup?: CrosswalkLookup;
	atlasRelease?: AtlasRelease;
	atlasReleaseHistory?: Map<string, AtlasRelease>;
	areaSearchIndex?: AreaSearchIndex;
	areaRelationshipIndex?: AreaRelationshipIndex;
	areaGeometryCache?: AreaGeometryCache;
	relationshipCandidateInventory?: RelationshipCandidateInventory;
	validationReport?: ValidationReport;
	namedLocationInventory?: NamedLocationInventory;
	namedLocationLookup?: NamedLocationLookup;
	dataCatalog?: DataCatalog;
	populationObservations?: PopulationObservationArtifact;
	populationLocalAuthorityObservations?: PopulationLocalAuthorityObservationArtifact;
	/** Every measure's observations bar the two population artifacts. */
	measureObservations?: AnyMeasureObservationArtifact[];
	measureCompatibilityInventory?: MeasureCompatibilityInventory;
	exportManifest?: ExportManifest;
};

/**
 * Route a request against named, independently-built catalogues. Keeping the
 * dependencies in one object prevents a newly added artifact from silently
 * shifting a long positional argument list at every call site.
 */
export const route = (
	method: string | undefined,
	url: string | undefined,
	context: RouteContext,
): ApiResponse => {
	const {
		boundaryRegistry: registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
		atlasRelease,
		atlasReleaseHistory,
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
	} = context;
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
					"/v1/data/{measure-id}/compare",
					"/v1/data/{measure-id}/aggregate",
					"/v1/data/{measure-id}/convert",
					"/v1/areas",
					"/v1/areas:contains",
					"/v1/areas/{type}/{release}/{code}",
					"/v1/areas/{type}/{release}/{code}/history",
					"/v1/areas/{type}/{release}/{code}/parents",
					"/v1/areas/{type}/{release}/{code}/children",
					"/v1/areas/{type}/{release}/{code}/relationships",
					"/v1/areas/{type}/{release}/{code}/geometry",
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
					"/v1/exports",
					"/v1/exports/{export-id}",
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
		segments[1] === "atlas-releases"
	) {
		return atlasReleaseHistory
			? {
					status: 200,
					body: envelope(
						releaseId,
						[...atlasReleaseHistory.values()]
							.map((release) => ({
								releaseId: release.releaseId,
								href: `/v1/atlas-releases/${release.releaseId}`,
								artifactCount: release.artifacts.length,
								current: release.releaseId === releaseId,
							}))
							.sort((left, right) =>
								left.releaseId.localeCompare(right.releaseId),
							),
					),
				}
			: problem(
					503,
					"Catalogue Unavailable",
					"Build the atlas release history before listing releases.",
				);
	}

	if (
		segments.length === 3 &&
		segments[0] === "v1" &&
		segments[1] === "atlas-releases" &&
		segments[2] === "compare"
	) {
		if (!atlasReleaseHistory) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the atlas release history before comparing releases.",
			);
		}
		const fromId = parsedUrl.searchParams.get("from");
		const toId = parsedUrl.searchParams.get("to") ?? releaseId;
		if (!fromId) {
			return problem(
				400,
				"Invalid Query",
				"from is required; to defaults to the current Atlas release.",
			);
		}
		const from = atlasReleaseHistory.get(fromId);
		const to = atlasReleaseHistory.get(toId);
		if (!from || !to) {
			return problem(
				404,
				"Not Found",
				"One or both requested Atlas releases are not archived by this API instance.",
			);
		}
		return {
			status: 200,
			body: envelope(releaseId, compareAtlasReleases(from, to)),
		};
	}

	if (
		segments.length === 3 &&
		segments[0] === "v1" &&
		segments[1] === "atlas-releases"
	) {
		const requested = atlasReleaseHistory?.get(segments[2] as string);
		return requested
			? { status: 200, body: envelope(releaseId, requested) }
			: problem(
					404,
					"Not Found",
					"No archived Atlas release matches that identity.",
				);
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
			const compatibility = measureCompatibilityInventory.measures
				.find((candidate) => candidate.measureId === measureId)
				?.sources.find(
					(candidate) =>
						candidate.datasetId === source.datasetId &&
						candidate.sourceGeography.type ===
							source.sourceGeography.type &&
						candidate.sourceGeography.boundaryYear ===
							source.sourceGeography.boundaryYear &&
						candidate.periods.includes(period as string),
				)
				?.candidates.find(
					(candidate) =>
						candidate.boundaryRelease === sourceRelease &&
						(candidate.status === "exact-code-set" ||
							candidate.status === "code-set-compatible"),
				);
			if (!compatibility) {
				return problem(
					422,
					"Operation Not Supported",
					"The requested sourceRelease is not code-set compatible with this source partition.",
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
				);
			}
			const membership = fullRegionMembership(crosswalk, regionCode);
			if (!membership || membership.unsafeSourceCount > 0) {
				return problem(
					422,
					"Operation Not Supported",
					"The selected region is not represented by complete one-to-one source-area membership in that crosswalk.",
				);
			}
			return {
				crosswalk,
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
		if (byLocation && byLocation.unresolvedMemberCodes.length > 0) {
			return problem(
				422,
				"Operation Not Supported",
				"The named location is not a complete direct code match for this source partition; no conversion or partial sum was applied.",
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
							note: weighting
								? "Every curated location member code was found in both source-exact value and weight partitions."
								: "Every curated location member code was found in the published source partition.",
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
								note: "Regional membership comes from the caller-selected crosswalk; every included local authority is wholly covered by this one region.",
							}
						: {
								operation: weighting ? "weighted-mean" : "sum",
								membership: "gss-country-code",
								inputRecordCount: aggregate.members.length,
								coverage: {
									href: `/v1/measures/${measureId}/coverage`,
									note: "The sum covers every area of this country published in this source partition. That is not a claim of national completeness; the coverage report states which boundary releases the partition is a complete code set for.",
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
			return problem(422, "Operation Not Supported", converted.reason);
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
		segments[1] === "attribution"
	) {
		if (!dataCatalog || !crosswalkInventory) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the data catalogue and crosswalk inventory before generating attribution.",
			);
		}
		const request = {
			datasets: parsedUrl.searchParams.getAll("dataset"),
			measures: parsedUrl.searchParams.getAll("measure"),
			boundaryReleases: parsedUrl.searchParams.getAll("boundaryRelease"),
			crosswalks: parsedUrl.searchParams.getAll("crosswalk"),
		};
		if (Object.values(request).every((values) => values.length === 0)) {
			return problem(
				400,
				"Invalid Query",
				"Name at least one resource to attribute, as dataset, measure, boundaryRelease or crosswalk. Each may be repeated.",
			);
		}
		const attribution = attributionFor(
			request,
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
		return {
			status: 200,
			body: envelope(releaseId, {
				atlasRelease: { id: releaseId, href: "/v1/atlas-release" },
				resources: attribution.resources,
				licences: attribution.licences,
				text: attributionText(
					attribution.resources,
					attribution.licences,
					releaseId,
				),
				note: "Licence names are reproduced as the publisher states them and are not interpreted here. Where several apply, check each before reusing the combined work.",
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
			return problem(
				404,
				"Not Found",
				"No compiled area matches that identity.",
			);
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
			return problem(
				404,
				"Not Found",
				"No compiled area matches that identity.",
			);
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
		segments[5] === "geometry"
	) {
		const [geography, boundaryRelease, code] = segments.slice(2, 5);
		const area = findArea(
			areaLookup,
			geography as string,
			boundaryRelease as string,
			code as string,
		);
		if (!area)
			return problem(
				404,
				"Not Found",
				"No compiled area matches that identity.",
			);
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
						geometrySource: areaGeometryCache.provenance(
							geography as string,
							boundaryRelease as string,
							code as string,
						),
					},
					geometry,
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
			return problem(
				404,
				"Not Found",
				"No compiled area matches that identity.",
			);
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
		segments[1] === "relationship-candidates"
	) {
		return relationshipCandidateInventory
			? {
					status: 200,
					body: envelope(
						releaseId,
						relationshipCandidateInventory.candidates,
					),
				}
			: problem(
					503,
					"Catalogue Unavailable",
					"Build the relationship candidate inventory before starting the API.",
				);
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "exports"
	) {
		return exportManifest
			? {
					status: 200,
					body: envelope(releaseId, {
						...exportManifest,
						note: "Each export is the immutable, source-exact JSON observation artifact used by the API.",
					}),
				}
			: problem(
					503,
					"Catalogue Unavailable",
					"Build the export manifest before listing bulk exports.",
				);
	}

	if (
		segments.length === 3 &&
		segments[0] === "v1" &&
		segments[1] === "exports"
	) {
		if (!exportManifest || !dataCatalog) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the data catalogue and export manifest before downloading bulk exports.",
			);
		}
		const listedExport = exportManifest.exports.find(
			(candidate) => candidate.id === segments[2],
		);
		if (!listedExport) {
			return problem(
				404,
				"Not Found",
				"No bulk export matches that identity.",
			);
		}
		const measure = dataCatalog.measures.find(
			(candidate) => candidate.id === listedExport.measureId,
		);
		const source = measure?.sources.find(
			(candidate) =>
				candidate.datasetId === listedExport.datasetId &&
				candidate.sourceGeography.type ===
					listedExport.sourceGeography.type &&
				candidate.sourceGeography.boundaryYear ===
					listedExport.sourceGeography.boundaryYear &&
				candidate.periods.length === listedExport.periods.length &&
				candidate.periods.every(
					(period, index) => period === listedExport.periods[index],
				),
		);
		const artifact =
			measure && source
				? isLegacyPopulationSource(measure.id, source)
					? source.sourceGeography.type === "ward"
						? populationObservations
						: populationLocalAuthorityObservations
					: findMeasureObservations(
							measureObservations ?? [],
							measure.id,
							source,
						)
				: undefined;
		if (!artifact || artifact.contentHash !== listedExport.contentHash) {
			return problem(
				503,
				"Export Unavailable",
				"The catalogued export artifact is unavailable or does not match its manifest hash.",
			);
		}
		return {
			status: 200,
			body: envelope(releaseId, listedExport),
			representation: {
				contentType: "application/json",
				body: `${JSON.stringify(artifact)}\n`,
				headers: {
					"content-disposition": `attachment; filename=\"${listedExport.artifact}.json\"`,
				},
			},
		};
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

	const isValidationResource =
		segments[0] === "v1" &&
		segments[1] === "validation" &&
		((segments[2] === "boundary-releases" && segments.length === 5) ||
			(segments[2] === "crosswalks" && segments.length === 4));
	if (
		(segments.length === 2 &&
			segments[0] === "v1" &&
			segments[1] === "validation") ||
		isValidationResource
	) {
		if (!validationReport) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the validation report before starting the API.",
			);
		}
		if (isValidationResource) {
			// Resource ids repeat the validated resource's own API path.
			const id = segments.slice(2).join("/");
			const resource = validationReport.resources.find(
				(candidate) => candidate.id === id,
			);
			return resource
				? { status: 200, body: envelope(releaseId, resource) }
				: problem(
						404,
						"Not Found",
						"No validated resource matches that identity.",
					);
		}
		const status = parsedUrl.searchParams.get("status");
		if (status !== null && status !== "passed" && status !== "waived") {
			return problem(
				400,
				"Invalid Query",
				"status must be passed or waived.",
			);
		}
		const { resources, ...report } = validationReport;
		return {
			status: 200,
			body: envelope(releaseId, {
				...report,
				resources:
					status === null
						? resources
						: resources.filter(
								(resource) => resource.status === status,
							),
			}),
		};
	}

	return problem(404, "Not Found", "No API resource matches that path.");
};
