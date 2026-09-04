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

export interface DatasetDefinition<
	T extends { type: string; data: unknown } = { type: string; data: unknown },
> {
	type: T["type"];
	precompiledFile: string;
	/** Geography level used by the compiled records. */
	boundaryType: BoundaryType;
	source: DatasetSource;
	/** Build-time validation requirements for the loader output. */
	ingestion?: DatasetIngestionContract;
	/**
	 * True for a dataset that is precompiled and validated but deliberately has
	 * no chart yet — e.g. it has no boundary geometry to render against. The
	 * catalogue/chart parity checks treat this as an intentional, temporary
	 * gap rather than a registration bug.
	 */
	chartPending?: boolean;
	precompile: (reader: DatasetReader) => Promise<Record<string, T>>;
}
import type { BoundaryType } from "../boundaries/catalog";
