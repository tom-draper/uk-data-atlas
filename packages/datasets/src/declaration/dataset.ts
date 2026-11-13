import type { BoundaryType } from "../data/boundaries/catalog.ts";
import type {
	DatasetDefinition,
	DatasetIngestionContract,
	DatasetPayloadLayout,
	DatasetReader,
} from "../data/catalog/types.ts";
import type { DatasetCountry } from "../types/coverage.ts";
import type { DatasetTopic } from "./taxonomy.ts";
import type {
	DeclaredDataset,
	DeclaredHeader,
	DeclaredPayload,
} from "./statistics.ts";
import type { DatasetDisplay } from "./display.ts";
import { yearParts } from "./yearParts.ts";

/**
 * Everything the atlas knows about one dataset, in one module. The API
 * catalogue, the statistics tables, the manifest, the pipeline and the website
 * read it; nothing else describes the dataset. The statistics half extends
 * `DeclaredDataset`, which is how a compiled dataset is read into rows.
 */

export const UPDATE_CADENCES = [
	"monthly",
	"quarterly",
	"annual",
	"decennial",
	"irregular",
	"discontinued",
] as const;
export type UpdateCadence = (typeof UPDATE_CADENCES)[number];

export type DeclaredSource = {
	/** The dataset's title. */
	name: string;
	publisher: string;
	sourceUrl: string;
	licence: string;
	licenceUrl: string;
	/** The credit a user of the data must give. */
	attribution: string;
	description: string;
	/** The edition the data describes, such as `2026`. */
	year: string;
	/** How often the publisher releases a new edition. */
	cadence: UpdateCadence;
	/** Caveats that apply to every measure, in the publisher's terms. */
	notes: readonly string[];
	/** Date the source was retrieved, when known. */
	retrievedAt?: string;
};

/** The boundary release a dataset's records are keyed by. */
export type DeclaredBoundary = { type: BoundaryType; year: number };

/**
 * The statistics half of a declaration. `type` is the declaration's id and
 * `topic` its topic, so neither is repeated. The payload header is built
 * from the id and boundary unless `parts` says otherwise.
 */
export type DeclaredStatistics = Omit<
	DeclaredDataset,
	"type" | "topic" | "related" | "payload"
> & {
	payload: Omit<DeclaredPayload, "parts"> & {
		parts?: DeclaredPayload["parts"];
		/** Fields added to each part's standard header. */
		header?: DeclaredHeader;
	};
};

/** The kinds of API measure an indicator may publish. */
export type IndicatorValueKind =
	"count" | "quantity" | "ratio" | "currency" | "ordinal" | "categorical";

/** A share of something, which combines only as a weighted mean. */
export type IndicatorWeightedShare = {
	kind: "weighted-mean";
	weight: {
		/** What the weight is and why the published percentages need it. */
		description: string;
		/** The compiled dataset's field holding the weight. */
		datasetField: string;
	};
};

/** A published statistic that cannot be combined across areas. */
export type IndicatorNonAggregatable = {
	kind: "non-aggregatable";
	statistic: "median" | "rank" | "decile" | "life-expectancy";
	note: string;
};

/** One API catalogue measure read from a field of the compiled records. */
export type IndicatorDeclaration = {
	/** The measure id the API serves. */
	id: string;
	label: string;
	/** Path of the compiled record field holding the value. */
	field: string;
	valueKind: IndicatorValueKind;
	unit: string;
	/**
	 * The aggregation the API offers: a plain sum over areas, or a share that
	 * needs a mean weighted by another field, which the API does not serve.
	 */
	aggregation: "sum" | IndicatorWeightedShare | IndicatorNonAggregatable;
	notes: readonly string[];
	/** The statistics measure this indicator is a view of. */
	measure: string;
	/** Fixed members of the measure's dimensions. */
	members?: Readonly<Record<string, string>>;
};

/**
 * Single-period indicators over local authorities: each checked against the
 * set of authorities it claims before it is published.
 */
export type IndicatorCatalogue = {
	kind: "indicators";
	/**
	 * The period the indicators describe, such as `2026-04`, for a file of one
	 * period. A file of one entry per year sets `yearly` instead and publishes
	 * every year it holds.
	 */
	period?: string;
	yearly?: true;
	/**
	 * Check every record belongs to the authorities of the population
	 * estimate, and list any authority without a value.
	 */
	codes?: "authorities";
	/** Reduce the April 2023 authorities and their districts to authorities. */
	mergeApril2023?: true;
	coverageNote: string;
	indicators: readonly IndicatorDeclaration[];
};

export type DatasetDeclaration<
	T extends { type: string; data: unknown } = { type: string; data: unknown },
> = {
	/** The only identifier: kebab-case, used by the API, pipeline and website. */
	id: string;
	/**
	 * The camelCase manifest type of a dataset that predates kebab-case types,
	 * still the key of the website's chart code and of compiled payload
	 * headers. Dropped, with the website's keys, once those use the id.
	 */
	legacyType?: string;
	/** The one topic the dataset is filed under (see `DeclaredDataset`). */
	topic: DatasetTopic;
	/** Other topics the dataset is also listed under, never the primary. */
	related?: readonly DatasetTopic[];
	source: DeclaredSource;
	boundary: DeclaredBoundary;
	/**
	 * Further geography levels the dataset is published at, each on the same
	 * boundary release. `boundary` stays the level the website charts.
	 */
	additionalBoundaryTypes?: readonly BoundaryType[];
	/** Countries the source can cover, copied to each compiled vintage. */
	coverageCountries?: readonly DatasetCountry[];
	/** Build-time validation requirements for the loader output. */
	ingestion?: DatasetIngestionContract;
	/** How the compiled payload is sliced and delivered. */
	layout?: DatasetPayloadLayout;
	/** The record field the map-values sidecars are built from, if it has any. */
	mapValueField?: string;
	/** True for a dataset that is compiled but has no chart yet. */
	chartPending?: boolean;
	/** Publish the first display measure as a map-values dataset. */
	publishMapValues?: boolean;
	/** Reads the sources and writes the compiled payload, by edition. */
	load: (reader: DatasetReader) => Promise<Record<string, T>>;
	statistics: DeclaredStatistics;
	/** The API catalogue measures, when the dataset publishes any. */
	catalogue?: IndicatorCatalogue;
	display?: DatasetDisplay;
};

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Checks a declaration is well formed and returns it. */
export function defineDataset<T extends { type: string; data: unknown }>(
	declaration: DatasetDeclaration<T>,
): DatasetDeclaration<T> {
	if (!KEBAB.test(declaration.id))
		throw new Error(`Dataset id ${declaration.id} is not kebab-case`);
	if (declaration.publishMapValues && !declaration.display)
		throw new Error(
			`Dataset ${declaration.id} needs a display measure for map values`,
		);
	if (
		declaration.publishMapValues &&
		(declaration.display!.measures.length !== 1 ||
			typeof declaration.display!.measures[0].field !== "string")
	)
		throw new Error(
			`Dataset ${declaration.id} must have one map-values measure`,
		);
	const fixedMeasure = declaration.display?.card?.fixedMeasure;
	if (
		fixedMeasure &&
		!declaration.display?.measures.some(
			(measure) => measure.id === fixedMeasure && measure.card,
		)
	)
		throw new Error(
			`Dataset ${declaration.id} needs a card for fixed measure ${fixedMeasure}`,
		);
	return declaration;
}

/** The manifest type: the id, unless the dataset still has a legacy type. */
export const typeOf = (declaration: DatasetDeclaration): string =>
	declaration.legacyType ?? declaration.id;

/** The manifest definition the dataset compiler reads. */
export function definitionOf<T extends { type: string; data: unknown }>(
	declaration: DatasetDeclaration<T>,
): DatasetDefinition<T> {
	const { source } = declaration;
	return {
		type: typeOf(declaration) as T["type"],
		precompiledFile: declaration.id,
		boundaryType: declaration.boundary.type,
		...(declaration.additionalBoundaryTypes
			? {
					additionalBoundaryTypes:
						declaration.additionalBoundaryTypes,
				}
			: {}),
		...(declaration.coverageCountries
			? { coverageCountries: declaration.coverageCountries }
			: {}),
		source: {
			name: source.name,
			source: source.publisher,
			sourceUrl: source.sourceUrl,
			year: source.year,
			licence: source.licence,
			licenceUrl: source.licenceUrl,
			description: source.description,
			...(source.retrievedAt ? { retrievedAt: source.retrievedAt } : {}),
		},
		...(declaration.ingestion ? { ingestion: declaration.ingestion } : {}),
		...(declaration.layout ? { payload: declaration.layout } : {}),
		...(declaration.mapValueField
			? { mapValueField: declaration.mapValueField }
			: {}),
		...(declaration.chartPending ? { chartPending: true } : {}),
		...(declaration.publishMapValues && declaration.display
			? { mapValueField: declaration.display.measures[0].field as string }
			: {}),
		precompile: declaration.load,
	};
}

/** The statistics declaration the rows are written and read back from. */
export function statisticsOf(declaration: DatasetDeclaration): DeclaredDataset {
	const { payload, ...statistics } = declaration.statistics;
	const { header, parts, ...rest } = payload;
	return {
		...statistics,
		type: typeOf(declaration),
		topic: declaration.topic,
		...(declaration.related ? { related: declaration.related } : {}),
		payload: {
			...rest,
			parts:
				parts ??
				yearParts(
					declaration.id,
					declaration.boundary.type,
					declaration.boundary.year,
					header,
				),
		},
	};
}
