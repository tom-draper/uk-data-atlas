import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
	type DataCatalog,
	isLegacyPopulationSource,
	observationArtifactName,
} from "./dataCatalog";

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
		/** `periods` holds one block per period; `single-period` predates it. */
		layout: "periods" | "single-period";
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

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

const FIELD_DESCRIPTIONS: Record<string, string> = {
	areaCode:
		"The official code of the area, as the source partition gives it.",
	value: "The numeric value, in the measure's unit.",
	category: "A source-reported label, such as a winning party.",
	status: "`observed` for a value the publisher reported, `derived` for one this API computed.",
	confidenceInterval:
		"The publisher's interval around the value, with `lower` and `upper` bounds.",
};

type ArtifactRecords = {
	schemaVersion?: unknown;
	contentHash?: unknown;
	periods?: Array<{
		period: string;
		records: Array<Record<string, unknown>>;
	}>;
	period?: string;
	records?: Array<Record<string, unknown>>;
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

const legacyArtifactName = (measureId: string, datasetId: string) =>
	measureId === "population-estimate" && datasetId === "population"
		? "population-observations"
		: "population-local-authority-observations";

/**
 * Publish immutable, whole-artifact JSON downloads for every source partition.
 * The manifest does not manufacture a flattened export: consumers receive the
 * same source-exact observation artifact the API reads. Each entry describes
 * that artifact as read from it: its records, their fields and the datasets
 * that must be attributed.
 */
export const compileExportManifest = (
	publicDirectory: string,
	dataCatalog: DataCatalog,
): ExportManifest => {
	const exports = dataCatalog.measures
		.flatMap((measure) =>
			measure.sources.map((source): BulkExport => {
				const artifact = isLegacyPopulationSource(measure.id, source)
					? legacyArtifactName(measure.id, source.datasetId)
					: observationArtifactName(measure.id, source);
				const path = join(publicDirectory, `${artifact}.json`);
				if (!existsSync(path)) {
					throw new Error(
						`Build ${artifact}.json before building the export manifest.`,
					);
				}
				const content = readFileSync(path, "utf8");
				const parsed = JSON.parse(content) as ArtifactRecords;
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
				return {
					id: artifact,
					measureId: measure.id,
					datasetId: source.datasetId,
					periods: source.periods,
					sourceGeography: source.sourceGeography,
					format: "json",
					artifact,
					contentHash: parsed.contentHash,
					bytes: statSync(path).size,
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
					provenance: {
						measure: `/v1/measures/${measure.id}`,
						datasets: [
							{ id: source.datasetId, role: "source" },
							...(measure.derivedFrom?.datasetIds ?? [])
								.filter((id) => id !== source.datasetId)
								.map((id) => ({
									id,
									role: "derived-from" as const,
								})),
						],
					},
				};
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
