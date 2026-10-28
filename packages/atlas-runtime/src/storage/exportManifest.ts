import type { ObservationDownload } from "../catalogue/observationDownloads";

export type ExportField = {
	name: string;
	type: "string" | "number" | "object";
	/** True when every record in the artifact carries the field. */
	required: boolean;
};

/** A dataset's attribution and inputs, listed once for every export using it. */
export type ExportDataset = {
	publisher: string;
	sourceUrl: string;
	licence: { name: string; url?: string };
	inputs: Array<{ path: string; sha256: string }>;
	href: string;
};

export type BulkExport = {
	id: string;
	measureId: string;
	datasetId: string;
	periods: string[];
	sourceGeography: { type: string; boundaryYear: number };
	format: "json";
	formats?: ObservationDownload[];
	artifact: string;
	contentHash: string;
	bytes: number;
	href: string;
	/** Records in the artifact, counted from it. */
	recordCount: number;
	recordCountByPeriod: Record<string, number>;
	/** The artifact's shape and record fields, read from the artifact itself. */
	schema: {
		version: number;
		/**
		 * `periods` holds one block per period; `single-period` predates it;
		 * `table` holds one row per area with a value for each of `measures`.
		 */
		layout: "periods" | "single-period" | "table";
		/** For a `table`, the measure each value column serves, in order. */
		measures?: string[];
		recordType: "numeric" | "categorical";
		fields: ExportField[];
	};
	provenance: {
		measure: string;
		/**
		 * `source` publishes the values; `derived-from` is an input to a
		 * computed measure. Each id is described in the manifest's `datasets`.
		 */
		datasets: Array<{ id: string; role: "source" | "derived-from" }>;
	};
};

export type ExportManifest = {
	schemaVersion: 1;
	contentHash: string;
	dataCatalogHash: string;
	/** What each record field means, for every field any export carries. */
	fields: Record<string, string>;
	datasets: Record<string, ExportDataset>;
	exports: BulkExport[];
};
