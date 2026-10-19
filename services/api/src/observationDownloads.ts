import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { MeasureObservation } from "./dataCatalog";
import type { BulkExport } from "./exportManifest";
import { isMeasureTable, type MeasureTableArtifact } from "./observationTables";
import { writeParquet, type ParquetColumn } from "./parquet";
import { sha256 } from "./contentHash";

export type ObservationDownload = {
	format: "csv" | "parquet";
	artifact: string;
	href: string;
	bytes: number;
	contentHash: string;
};

type DownloadArtifact =
	| { periods: Array<{ period: string; records: MeasureObservation[] }> }
	| MeasureTableArtifact;

const columns = [
	["measureId", "string"],
	["unit", "string"],
	["datasetId", "string"],
	["geography", "string"],
	["boundaryYear", "int32"],
	["period", "string"],
	["areaCode", "string"],
	["sourceAreaCode", "string"],
	["value", "double"],
	["category", "string"],
	["status", "string"],
	["lowerBound", "double"],
	["upperBound", "double"],
] as const;

/** Flat downloads contain the named measure, including null cells in shared tables. */
export const compileObservationDownloads = (
	publicDirectory: string,
	entry: BulkExport,
	artifact: DownloadArtifact,
	unit: string,
): ObservationDownload[] => {
	const values: Array<Array<string | number | null>> = [];
	const add = (
		period: string,
		record:
			| MeasureObservation
			| { areaCode: string; value: number | null; status: "observed" },
	) => {
		const numeric = "value" in record;
		const interval =
			"confidenceInterval" in record
				? record.confidenceInterval
				: undefined;
		values.push([
			entry.measureId,
			unit,
			entry.datasetId,
			entry.sourceGeography.type,
			entry.sourceGeography.boundaryYear,
			period,
			record.areaCode,
			"sourceAreaCode" in record ? (record.sourceAreaCode ?? null) : null,
			numeric ? record.value : null,
			"category" in record ? record.category : null,
			record.status,
			interval?.lower ?? null,
			interval?.upper ?? null,
		]);
	};
	if (isMeasureTable(artifact)) {
		const index = artifact.measures.indexOf(entry.measureId);
		if (index === -1)
			throw new Error(`${artifact.id} does not serve ${entry.measureId}`);
		for (const [areaCode, ...cells] of artifact.records)
			add(artifact.period, {
				areaCode,
				value: cells[index] ?? null,
				status: "observed",
			});
	} else {
		for (const { period, records } of artifact.periods)
			for (const record of records) add(period, record);
	}
	const parquetColumns: ParquetColumn[] = columns.map(
		([name, type], index) => ({
			name,
			type,
			optional: true,
			values: values.map((row) => row[index]),
		}),
	);
	const csvCell = (value: string | number | null) =>
		value === null ? "" : `"${String(value).replaceAll('"', '""')}"`;
	const csv = `${columns.map(([name]) => csvCell(name)).join(",")}\r\n${values.map((row) => row.map(csvCell).join(",")).join("\r\n")}${values.length ? "\r\n" : ""}`;
	const parquet = writeParquet({
		columns: parquetColumns,
		metadata: {
			"uk-data-atlas": JSON.stringify({
				schemaVersion: 1,
				sourceContentHash: entry.contentHash,
				provenance: entry.provenance,
			}),
		},
	});
	mkdirSync(join(publicDirectory, "exports"), { recursive: true });
	return (
		[
			["csv", Buffer.from(csv)],
			["parquet", parquet],
		] as const
	).map(([format, body]) => {
		const artifact = `exports/${entry.id}.${format}`;
		writeFileSync(join(publicDirectory, artifact), body);
		return {
			format,
			artifact,
			href: `${entry.href}?format=${format}`,
			bytes: body.length,
			contentHash: sha256(body),
		};
	});
};
