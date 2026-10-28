import { readObservationText } from "@uk-data-atlas/atlas-runtime/storage";
import {
	type DataCatalog,
	type MeasureSource,
	type MeasureObservation,
	observationArtifactName,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	isMeasureTable,
	type MeasureTableArtifact,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import { sha256 } from "@uk-data-atlas/artifacts";
import { compileObservationDownloads } from "./observationDownloads";

import type {
	ExportField,
	ExportDataset,
	BulkExport,
	ExportManifest,
} from "@uk-data-atlas/atlas-runtime/storage";

const FIELD_DESCRIPTIONS: Record<string, string> = {
	areaCode: "The official code of the area in the served source partition.",
	sourceAreaCode:
		"The publisher-supplied code when a reviewed code-only correction changes areaCode; absent otherwise.",
	value: "The numeric value, in the measure's unit.",
	category: "A source-reported label, such as a winning party.",
	values: "In a table, one value for each of the table's measures, in the order `schema.measures` lists them; null where none is published.",
	status: "`observed` for a value the publisher reported, `derived` for one this API computed.",
	confidenceInterval:
		"The publisher's interval around the value, with `lower` and `upper` bounds.",
};

type ArtifactRecords = {
	schemaVersion?: unknown;
	contentHash?: unknown;
	periods?: Array<{
		period: string;
		records: Array<MeasureObservation & Record<string, unknown>>;
	}>;
	period?: string;
	records?: Array<MeasureObservation & Record<string, unknown>>;
};

/** The fields records carry, in first-seen order, refusing any undocumented one. */
const recordFields = (
	artifact: string,
	records: Array<Record<string, unknown>>,
): ExportField[] => {
	const fields = new Map<
		string,
		{ type: ExportField["type"]; count: number }
	>();
	for (const record of records) {
		for (const [name, value] of Object.entries(record)) {
			const type =
				typeof value === "number"
					? "number"
					: typeof value === "string"
						? "string"
						: "object";
			const field = fields.get(name);
			if (field && field.type !== type) {
				throw new Error(
					`${artifact}: ${name} is both ${field.type} and ${type}.`,
				);
			}
			fields.set(name, { type, count: (field?.count ?? 0) + 1 });
		}
	}
	return [...fields].map(([name, { type, count }]) => {
		if (!FIELD_DESCRIPTIONS[name]) {
			throw new Error(
				`${artifact}: records carry ${name}, which the export schema does not describe.`,
			);
		}
		return { name, type, required: count === records.length };
	});
};

const provenanceOf = (
	measure: DataCatalog["measures"][number],
	source: MeasureSource,
): BulkExport["provenance"] => ({
	measure: `/v1/measures/${measure.id}`,
	datasets: [
		{ id: source.datasetId, role: "source" },
		...(measure.derivedFrom?.datasetIds ?? [])
			.filter((id) => id !== source.datasetId)
			.map((id) => ({ id, role: "derived-from" as const })),
	],
});

/** The export of one measure whose artifact is a table it shares. */
const tableExport = (
	measure: DataCatalog["measures"][number],
	source: MeasureSource,
	table: MeasureTableArtifact,
	bytes: number,
): BulkExport => {
	const id = `${measure.id}-${source.sourceGeography.type}-${source.sourceGeography.boundaryYear}`;
	return {
		id,
		measureId: measure.id,
		datasetId: source.datasetId,
		periods: source.periods,
		sourceGeography: source.sourceGeography,
		format: "json",
		artifact: table.id,
		contentHash: table.contentHash,
		bytes,
		href: `/v1/exports/${id}`,
		recordCount: table.records.length,
		recordCountByPeriod: { [table.period]: table.records.length },
		schema: {
			version: table.schemaVersion,
			layout: "table",
			recordType: "numeric",
			measures: table.measures,
			fields: [
				{ name: "areaCode", type: "string", required: true },
				{ name: "values", type: "number", required: true },
			],
		},
		provenance: provenanceOf(measure, source),
	};
};

const exportDataset = (dataCatalog: DataCatalog, id: string): ExportDataset => {
	const dataset = dataCatalog.datasets.find(
		(candidate) => candidate.id === id,
	);
	if (!dataset) throw new Error(`The data catalogue has no ${id} dataset.`);
	return {
		publisher: dataset.publisher,
		sourceUrl: dataset.sourceUrl,
		licence: dataset.licence,
		inputs: dataset.inputs.map(({ path, sha256 }) => ({ path, sha256 })),
		href: `/v1/datasets/${id}`,
	};
};

/** Describe source JSON artifacts and prebuild flat CSV and Parquet downloads. */
export const compileExportManifest = (
	publicDirectory: string,
	dataCatalog: DataCatalog,
	databasePath: string,
): ExportManifest => {
	const exports = dataCatalog.measures
		.flatMap((measure) =>
			measure.sources.map((source): BulkExport => {
				const artifact = observationArtifactName(measure.id, source);
				const content = readObservationText(databasePath, artifact);
				const table = JSON.parse(content) as unknown;
				// A table is several measures' artifact, so each of them
				// exports the whole table under an id of its own.
				if (isMeasureTable(table)) {
					const entry = tableExport(
						measure,
						source,
						table,
						Buffer.byteLength(content),
					);
					entry.formats = compileObservationDownloads(
						publicDirectory,
						entry,
						table,
						measure.unit,
					);
					return entry;
				}
				const parsed = table as ArtifactRecords;
				if (typeof parsed.contentHash !== "string") {
					throw new Error(`${artifact}.json has no content hash.`);
				}
				const periods = parsed.periods
					? parsed.periods
					: parsed.period && parsed.records
						? [{ period: parsed.period, records: parsed.records }]
						: undefined;
				if (!periods) {
					throw new Error(
						`${artifact}.json has no observation records.`,
					);
				}
				const records = periods.flatMap((period) => period.records);
				const fields = recordFields(`${artifact}.json`, records);
				const entry: BulkExport = {
					id: artifact,
					measureId: measure.id,
					datasetId: source.datasetId,
					periods: source.periods,
					sourceGeography: source.sourceGeography,
					format: "json",
					artifact,
					contentHash: parsed.contentHash,
					bytes: Buffer.byteLength(content),
					href: `/v1/exports/${artifact}`,
					recordCount: records.length,
					recordCountByPeriod: Object.fromEntries(
						periods.map((period) => [
							period.period,
							period.records.length,
						]),
					),
					schema: {
						version: Number(parsed.schemaVersion),
						layout: parsed.periods ? "periods" : "single-period",
						recordType: fields.some(
							(field) => field.name === "category",
						)
							? "categorical"
							: "numeric",
						fields,
					},
					provenance: provenanceOf(measure, source),
				};
				entry.formats = compileObservationDownloads(
					publicDirectory,
					entry,
					{ periods },
					measure.unit,
				);
				return entry;
			}),
		)
		.sort((left, right) => left.id.localeCompare(right.id));
	if (new Set(exports.map((item) => item.id)).size !== exports.length) {
		throw new Error("Each bulk export must have a unique artifact name.");
	}
	const usedFields = new Set(
		exports.flatMap((item) =>
			item.schema.fields.map((field) => field.name),
		),
	);
	const fields = Object.fromEntries(
		Object.entries(FIELD_DESCRIPTIONS).filter(([name]) =>
			usedFields.has(name),
		),
	);
	const datasets = Object.fromEntries(
		[
			...new Set(
				exports.flatMap((item) =>
					item.provenance.datasets.map((dataset) => dataset.id),
				),
			),
		]
			.sort()
			.map((id) => [id, exportDataset(dataCatalog, id)]),
	);
	const content = JSON.stringify({
		schemaVersion: 1,
		dataCatalogHash: dataCatalog.contentHash,
		fields,
		datasets,
		exports,
	});
	return {
		schemaVersion: 1,
		contentHash: sha256(content),
		dataCatalogHash: dataCatalog.contentHash,
		fields,
		datasets,
		exports,
	};
};
