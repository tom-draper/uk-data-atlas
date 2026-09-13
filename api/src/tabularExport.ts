import type { MeasureSource } from "./dataCatalog";
import type { CallerSelectedGeometry } from "./sourceExactProvenance";

export type TabularFormat = "csv" | "ndjson";

export type MeasureExportRecord = {
	areaCode: string;
	value: number;
	status: "observed" | "derived";
	confidenceInterval?: { lower: number; upper: number };
	area?: {
		id: string;
		code: string;
		name: string;
		aliases?: string[];
	};
};

type MeasureExportInput = {
	atlasRelease: string;
	measureId: string;
	/** Carried per row so a downloaded file cannot be read in the wrong unit. */
	unit: string;
	source: MeasureSource;
	period: string;
	geometry?: CallerSelectedGeometry;
	records: MeasureExportRecord[];
};

const csvValue = (value: string | number) =>
	`"${String(value).replaceAll('"', '""')}"`;

const exportRows = ({
	atlasRelease,
	measureId,
	unit,
	source,
	period,
	geometry,
	records,
}: MeasureExportInput) =>
	records.map((record) => ({
		atlasRelease,
		measureId,
		unit,
		datasetId: source.datasetId,
		period,
		geography: source.sourceGeography.type,
		boundaryYear: source.sourceGeography.boundaryYear,
		boundaryRelease: geometry?.boundaryRelease ?? "",
		geometryCompatibility: geometry?.compatibility ?? "",
		transformationStatus: "not-applied",
		areaCode: record.areaCode,
		areaId: record.area?.id ?? "",
		areaName: record.area?.name ?? "",
		areaAliases: record.area?.aliases?.join(" | ") ?? "",
		value: record.value,
		status: record.status,
		lowerBound: record.confidenceInterval?.lower ?? "",
		upperBound: record.confidenceInterval?.upper ?? "",
	}));

const columns = [
	"atlasRelease",
	"measureId",
	"unit",
	"datasetId",
	"period",
	"geography",
	"boundaryYear",
	"boundaryRelease",
	"geometryCompatibility",
	"transformationStatus",
	"areaCode",
	"areaId",
	"areaName",
	"areaAliases",
	"value",
	"status",
	// Appended rather than placed beside the value, so existing columns keep
	// their positions. Empty where the publisher gives no interval.
	"lowerBound",
	"upperBound",
] as const;

/**
 * Serialize a page of source-exact observations for tools that do not consume
 * the JSON API envelope. Every row repeats the minimum provenance necessary
 * to keep a downloaded page interpretable outside the Atlas API.
 */
export const exportMeasureRecords = (
	format: TabularFormat,
	input: MeasureExportInput,
): { contentType: string; body: string } => {
	const rows = exportRows(input);
	if (format === "ndjson") {
		return {
			contentType: "application/x-ndjson; charset=utf-8",
			body:
				rows.map((row) => JSON.stringify(row)).join("\n") +
				(rows.length ? "\n" : ""),
		};
	}
	return {
		contentType: "text/csv; charset=utf-8",
		body:
			[
				columns.join(","),
				...rows.map((row) =>
					columns.map((column) => csvValue(row[column])).join(","),
				),
			].join("\n") + "\n",
	};
};
