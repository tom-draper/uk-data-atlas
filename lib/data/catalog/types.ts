import type { BoundaryType } from "../boundaries/catalog";
import type { DatasetCountry } from "@/lib/types/coverage";

/**
 * Framework-neutral dataset contracts.
 *
 * These describe what the Atlas knows about a dataset and how it is compiled.
 * Rendering concerns (charts, colours, MapLibre aggregation) intentionally
 * live in lib/datasets instead, so this layer can be reused by build tools,
 * an API, or a CLI.
 */

export interface DatasetSource {
	name: string;
	source: string;
	sourceUrl: string;
	year: string;
	licence: string;
	licenceUrl: string;
	description: string;
	/** Date the source was retrieved, when known. */
	retrievedAt?: string;
}

export interface DatasetReader {
	text: (path: string) => Promise<string>;
	/** One named worksheet from an .xlsx workbook, rendered as CSV. */
	xlsxSheet: (path: string, sheet: string) => Promise<string>;
	/**
	 * The same for a legacy .xls workbook, which may be given directly or as
	 * the single entry of a .zip, the form some publishers ship it in.
	 */
	xlsSheet: (path: string, sheet: string) => Promise<string>;
	odsContent: (path: string) => Promise<string>;
	zipCsv: (path: string) => Promise<string>;
}

export interface DatasetIngestionContract {
	/** Minimum number of dataset vintages emitted by the loader. Defaults to 1. */
	minimumDatasets?: number;
	/** Minimum number of geography-keyed records in each emitted dataset. Defaults to 1. */
	minimumDataRecords?: number;
	/** Reject outputs joined to an unexpected boundary vintage. */
	expectedBoundaryYears?: readonly number[];
	/** Fields that every geography-keyed record must contain. */
	requiredDataFields?: readonly string[];
}

/** The code-keyed maps used by the standard compiled dataset payload. */
export const DEFAULT_CODE_KEYED_FIELDS = ["data", "results"] as const;

export type DatasetLocationScope =
	| { kind: "boundary" }
	| {
			/**
			 * Records are keyed by another geography. The mapping holds source
			 * boundary code → record code, as with LAD → ICB waiting-time data.
			 */
			kind: "mapped";
			mappingField: string;
	  };

export interface RegionalChunkLayout {
	kind: "regional";
	/** Use ward → LAD mappings when a record has no usable LAD code of its own. */
	wardToLadFallback?: boolean;
	/** Include the compact all-location population totals in every chunk. */
	populationSummary?: boolean;
	/** Precompute the card aggregate this payload needs for each named location. */
	locationAggregate?: "population" | "localElection";
}

/**
 * How a compiled payload is sliced and delivered. This stays framework-neutral
 * so the precompiler and browser worker use the same declaration.
 */
export interface DatasetPayloadLayout {
	/** Maps keyed by the dataset's own record codes. Defaults to data + results. */
	codeKeyedFields?: readonly string[];
	/** How records are reached from a selected named location. */
	locationScope?: DatasetLocationScope;
	/** Omit unless this dataset is large enough to serve in regional chunks. */
	regionChunks?: RegionalChunkLayout;
}

export const codeKeyedFieldsFor = (
	layout?: DatasetPayloadLayout,
): readonly string[] => layout?.codeKeyedFields ?? DEFAULT_CODE_KEYED_FIELDS;

export interface DatasetDefinition<
	T extends { type: string; data: unknown } = { type: string; data: unknown },
> {
	type: T["type"];
	precompiledFile: string;
	/** Geography level used by the compiled records. */
	boundaryType: BoundaryType;
	/** Countries the source can cover, copied to each compiled vintage. */
	coverageCountries?: readonly DatasetCountry[];
	source: DatasetSource;
	/** Build-time validation requirements for the loader output. */
	ingestion?: DatasetIngestionContract;
	/** Transport semantics shared by the precompiler and browser data worker. */
	payload?: DatasetPayloadLayout;
	/**
	 * True for a dataset that is precompiled and validated but deliberately has
	 * no chart yet — e.g. it has no boundary geometry to render against. The
	 * catalogue/chart parity checks treat this as an intentional, temporary
	 * gap rather than a registration bug.
	 */
	chartPending?: boolean;
	precompile: (reader: DatasetReader) => Promise<Record<string, T>>;
}
