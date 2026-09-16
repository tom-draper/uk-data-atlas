export type DatasetCatalogueEntry = {
	id: string;
	label: string;
	publisher: string;
	sourceUrl: string;
	temporalCoverage: string;
	licence: { name: string; url?: string };
	description?: string;
	inputs: Array<{
		kind: string;
		path: string;
		bytes: number;
		sha256: string;
	}>;
	summary: {
		datasetCount: number;
		dataRecordCount: number;
		boundaryYears: number[];
	};
	compiled: { bytes: number; sha256: string };
};

export type Country = "GB-ENG" | "GB-NIR" | "GB-SCT" | "GB-WLS";

export type SourceGeography = {
	/**
	 * The small-area geographies are the four nations' deprivation units, and
	 * they are not interchangeable: an English LSOA, a Scottish data zone and a
	 * Northern Irish super output area are drawn to different sizes and rules.
	 */
	type:
		| "ward"
		| "localAuthority"
		| "constituency"
		| "communitySafetyPartnership"
		| "lsoa"
		| "dataZone"
		| "superOutputArea";
	boundaryYear: number;
};

export type MeasureSource = {
	datasetId: string;
	periods: string[];
	sourceGeography: SourceGeography;
	/**
	 * The observation artifact's filename stem, when one dataset contributes
	 * more than one source-geography partition to the same measure. Most
	 * measures retain the conventional measure-id filename.
	 */
	observationArtifact?: string;
	coverage: {
		kind: "partial" | "source-reported";
		countries: Country[];
		recordCount: number;
		note: string;
	};
};

/**
 * How a measure may legitimately be combined over areas.
 *
 * The distinction is the one that stops an API from producing confident
 * nonsense. An extensive value adds: two authorities' tonnes of CO2e are a
 * region's tonnes. An intensive value does not: two authorities' coverage
 * percentages are not a region's coverage, and averaging them flat weighs a
 * thousand premises the same as half a million. `available` says whether the
 * API currently exposes the operation for the measure.
 */
export type MeasureAggregation =
	| { kind: "extensive"; operation: "sum"; available: boolean }
	| {
			kind: "categorical";
			available: false;
			note: string;
	  }
	| {
			kind: "intensive";
			operation: "weighted-mean";
			/** The denominator a caller has to weight by, and where to find it. */
			weight: {
				description: string;
				datasetField: string;
				/** Published measure that supplies the weight when aggregation is available. */
				measureId?: string;
			};
			available: boolean;
	  }
	| {
			/**
			 * No operation recovers a combined value. A median of medians is not
			 * the median of the underlying sales, and no weight fixes that; the
			 * same is true of a rank or a decile. The statistic is named so a
			 * caller can see why rather than just that.
			 */
			kind: "non-aggregatable";
			statistic: "median" | "rank" | "decile" | "life-expectancy";
			note: string;
			available: false;
	  };

export type Measure = {
	id: string;
	label: string;
	valueKind:
		"count" | "quantity" | "ratio" | "currency" | "ordinal" | "categorical";
	unit: string;
	aggregation: MeasureAggregation;
	sources: MeasureSource[];
	availability: {
		sourceExact: true;
		conversion: false;
		aggregation: boolean;
	};
	links: { data: string };
	/**
	 * The question this measure answers, where another nation publishes its own
	 * answer to the same one. Set alongside `elsewhere`.
	 */
	concept?: string;
	/**
	 * Measures covering nations this one does not. `comparable` says whether
	 * they may be read as one series; for the four national deprivation
	 * indices it is false, and the reason says why.
	 */
	elsewhere?: Array<{
		measureId: string;
		countries: string[];
		comparable: boolean;
		reason: string;
		href: string;
	}>;
	/**
	 * Set when this measure is computed from others rather than published. The
	 * datasets named here are inputs to the computation and must be attributed
	 * alongside the measure's own sources.
	 */
	derivedFrom?: { datasetIds: string[]; note: string };
	/**
	 * Set when the publisher reports an interval around each value. Records then
	 * carry `confidenceInterval`; a value with no published interval has none,
	 * and no interval is ever computed here.
	 */
	uncertainty?: {
		kind: "confidence-interval";
		level: number;
		note: string;
	};
	/** Anything a caller must know to read the values correctly. */
	notes?: string[];
};

/** @deprecated Use `MeasureSource`; kept so existing imports keep compiling. */
export type PopulationSource = MeasureSource;
/** @deprecated Use `Measure`. */
export type PopulationMeasure = Measure;

export type DataCatalog = {
	schemaVersion: 1;
	contentHash: string;
	source: {
		artifact: "data/precompiled/dataset-manifest.json";
		manifestVersion: number;
	};
	datasets: DatasetCatalogueEntry[];
	measures: Measure[];
};

export type PopulationObservation = {
	areaCode: string;
	value: number;
	/**
	 * `observed` is a value the publisher reported. `derived` is one this API
	 * computed from other measures, and no publisher is answerable for it.
	 */
	status: "observed" | "derived";
	/**
	 * The publisher's interval around this value, where one is published. The
	 * measure's `uncertainty` says what kind of interval it is.
	 */
	confidenceInterval?: { lower: number; upper: number };
};

/** A source-reported label, intentionally distinct from a numeric value. */
export type CategoricalObservation = {
	areaCode: string;
	category: string;
	status: "observed";
};

export type MeasureObservation = PopulationObservation | CategoricalObservation;

export const isNumericObservation = (
	record: MeasureObservation,
): record is PopulationObservation => "value" in record;

export type PopulationObservationArtifact = {
	schemaVersion: 1;
	contentHash: string;
	measureId: "population-estimate";
	period: "2022";
	sourceGeography: { type: "ward"; boundaryYear: 2023 };
	records: PopulationObservation[];
};

/**
 * A measure's observations, one block per period. The ward population artifact
 * predates this shape and carries a single period at the top level; everything
 * published since uses this.
 */
export type MeasureObservationArtifact<
	T extends MeasureObservation = PopulationObservation,
> = {
	schemaVersion: 1;
	contentHash: string;
	measureId: string;
	sourceGeography: SourceGeography;
	periods: Array<{ period: string; records: T[] }>;
};

export type AnyMeasureObservationArtifact =
	| MeasureObservationArtifact
	| MeasureObservationArtifact<CategoricalObservation>;

export type PopulationLocalAuthorityObservationArtifact = {
	schemaVersion: 1;
	contentHash: string;
	measureId: "population-estimate";
	sourceGeography: { type: "localAuthority"; boundaryYear: 2023 };
	periods: Array<{ period: string; records: PopulationObservation[] }>;
};

/**
 * The population artifacts that predate the per-period convention, which
 * carry their own shapes and file names.
 */
const LEGACY_POPULATION_DATASETS = new Set(["population", "population-uk"]);

export const isLegacyPopulationSource = (
	measureId: string,
	source: MeasureSource,
) =>
	measureId === "population-estimate" &&
	LEGACY_POPULATION_DATASETS.has(source.datasetId);

/**
 * The published file, without its extension, holding one measure source's
 * observations. A single-source measure keeps `{measure-id}-observations`; each
 * further source of a multi-source measure is named for its dataset.
 */
export const observationArtifactName = (
	measureId: string,
	source: MeasureSource,
) => {
	if (source.observationArtifact) return source.observationArtifact;
	if (measureId !== "population-estimate") return `${measureId}-observations`;
	if (source.datasetId === "population") return "population-observations";
	if (source.datasetId === "population-uk")
		return "population-local-authority-observations";
	return `${source.datasetId}-observations`;
};

/** The artifact holding a non-legacy measure source's observations. */
export const findMeasureObservations = (
	artifacts: AnyMeasureObservationArtifact[],
	measureId: string,
	source: MeasureSource,
) =>
	artifacts.find(
		(candidate) =>
			candidate.measureId === measureId &&
			candidate.sourceGeography.type === source.sourceGeography.type &&
			candidate.sourceGeography.boundaryYear ===
				source.sourceGeography.boundaryYear,
	);
