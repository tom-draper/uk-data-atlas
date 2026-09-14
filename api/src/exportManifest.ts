import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
	type DataCatalog,
	isLegacyPopulationSource,
	observationArtifactName,
} from "./dataCatalog";

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
};

export type ExportManifest = {
	schemaVersion: 1;
	contentHash: string;
	dataCatalogHash: string;
	exports: BulkExport[];
};

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

const legacyArtifactName = (measureId: string, datasetId: string) =>
	measureId === "population-estimate" && datasetId === "population"
		? "population-observations"
		: "population-local-authority-observations";

/**
 * Publish immutable, whole-artifact JSON downloads for every source partition.
 * The manifest does not manufacture a flattened export: consumers receive the
 * same source-exact observation artifact the API reads.
 */
export const compileExportManifest = (
	publicDirectory: string,
	dataCatalog: DataCatalog,
): ExportManifest => {
	const exports = dataCatalog.measures
		.flatMap((measure) =>
			measure.sources.map((source) => {
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
				const parsed = JSON.parse(content) as { contentHash?: unknown };
				if (typeof parsed.contentHash !== "string") {
					throw new Error(`${artifact}.json has no content hash.`);
				}
				return {
					id: artifact,
					measureId: measure.id,
					datasetId: source.datasetId,
					periods: source.periods,
					sourceGeography: source.sourceGeography,
					format: "json" as const,
					artifact,
					contentHash: parsed.contentHash,
					bytes: statSync(path).size,
					href: `/v1/exports/${artifact}`,
				};
			}),
		)
		.sort((left, right) => left.id.localeCompare(right.id));
	if (new Set(exports.map((item) => item.id)).size !== exports.length) {
		throw new Error("Each bulk export must have a unique artifact name.");
	}
	const content = JSON.stringify({
		schemaVersion: 1,
		dataCatalogHash: dataCatalog.contentHash,
		exports,
	});
	return {
		schemaVersion: 1,
		contentHash: sha256(content),
		dataCatalogHash: dataCatalog.contentHash,
		exports,
	};
};
