import type { PopulationSource } from "./dataCatalog";
import type { CallerSelectedGeometry } from "./sourceExactProvenance";

export type TabularFormat = "csv" | "ndjson";

export type PopulationExportRecord = {
	areaCode: string;
	value: number;
	status: "observed";
	area?: {
		id: string;
		code: string;
		name: string;
		aliases?: string[];
	};
};

type PopulationExportInput = {
	atlasRelease: string;
	measureId: string;
	source: PopulationSource;
	period: string;
	geometry?: CallerSelectedGeometry;
	records: PopulationExportRecord[];
};

const csvValue = (value: string | number) =>
	`"${String(value).replaceAll('"', '""')}"`;

const exportRows = ({
	atlasRelease,
	measureId,
	source,
	period,
	geometry,
	records,
}: PopulationExportInput) =>
	records.map((record) => ({
		atlasRelease,
		measureId,
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
	}));

const columns = [
	"atlasRelease",
	"measureId",
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
] as const;

/**
 * Serialize a page of source-exact observations for tools that do not consume
 * the JSON API envelope. Every row repeats the minimum provenance necessary
 * to keep a downloaded page interpretable outside the Atlas API.
 */
export const exportPopulationRecords = (
	format: TabularFormat,
	input: PopulationExportInput,
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
