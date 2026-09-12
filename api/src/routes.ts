import type { AreaLookup } from "./areaInventory";
import type { AreaGeometryCache } from "./areaGeometry";
import {
	createAreaRelationshipIndex,
	type AreaRelationshipIndex,
} from "./areaRelationships";
import type { AtlasRelease } from "./atlasRelease";
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
import type {
	DataCatalog,
	MeasureObservationArtifact,
	MeasureSource,
	PopulationObservation,
	PopulationLocalAuthorityObservationArtifact,
	PopulationObservationArtifact,
} from "./dataCatalog";
import type { MeasureCompatibilityInventory } from "./measureCompatibility";
import { compareObservations } from "./comparison";
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
		measureObservations?: MeasureObservationArtifact[];
	},
):
	| (ObservationArtifactReference & { records: PopulationObservation[] })
	| undefined => {
	if (measureId === "population-estimate") {
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
	const byMeasure = (artifacts.measureObservations ?? []).find(
		(candidate) => candidate.measureId === measureId,
	);
	const records = byMeasure?.periods.find(
		(candidate) => candidate.period === period,
	)?.records;
	return byMeasure && records
		? {
				artifact: `${byMeasure.measureId}-observations`,
				contentHash: byMeasure.contentHash,
				records,
			}
		: undefined;
};

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
	measureObservations?: MeasureObservationArtifact[];
	measureCompatibilityInventory?: MeasureCompatibilityInventory;
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
					"/v1/data/{measure-id}",
					"/v1/data/{measure-id}/series",
					"/v1/data/{measure-id}/rankings",
					"/v1/data/{measure-id}/compare",
					"/v1/areas",
					"/v1/areas:contains",
					"/v1/areas/{type}/{release}/{code}",
					"/v1/areas/{type}/{release}/{code}/history",
					"/v1/areas/{type}/{release}/{code}/parents",
					"/v1/areas/{type}/{release}/{code}/children",
					"/v1/areas/{type}/{release}/{code}/relationships",
					"/v1/areas/{type}/{release}/{code}/geometry",
					"/v1/translations",
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
					"/v1/atlas-release",
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
		const baseline = observations.records.find(
			(record) => record.areaCode === baselineAreaCode,
		);
		const comparison = observations.records.find(
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
		const order = readRankingOrder(parsedUrl.searchParams.get("order"));
		if (!order) {
			return problem(400, "Invalid Query", "order must be asc or desc.");
		}
		const ranked = rankObservations(observations.records, order);
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
		const exportRecords = recordsWithAreas.filter(
			(record): record is MeasureExportRecord => record !== undefined,
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
					records: exportRecords,
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
			if (
				crosswalk.from.geography !== source.geography ||
				crosswalk.from.boundaryRelease !== source.boundaryRelease ||
				crosswalk.to.geography !== target.geography ||
				crosswalk.to.boundaryRelease !== target.boundaryRelease
			)
				return [];
			const record = crosswalk.records.find(
				(candidate) => candidate.source.code === source.code,
			);
			if (!record) return [];
			const validForPurpose =
				(purpose === "identity" &&
					crosswalk.method === "official-lookup") ||
				(purpose === "membership" &&
					crosswalk.method === "clean-containment") ||
				(purpose === "apportion" &&
					crosswalk.method === "area-overlap");
			return validForPurpose
				? [
						{
							crosswalk: {
								id: crosswalk.id,
								method: crosswalk.method,
								quality: crosswalk.quality,
								weighting: crosswalk.weighting,
							},
							source: record.source,
							targets: record.targets,
						},
					]
				: [];
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
