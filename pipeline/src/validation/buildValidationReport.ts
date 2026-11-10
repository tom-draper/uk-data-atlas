import { buildArtifactPath } from "@uk-data-atlas/areas";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AreaInventory, AreaReleaseArtifact } from "@uk-data-atlas/areas";
import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import type { CrosswalkInventory } from "@uk-data-atlas/relationships";
import type { DataCatalog } from "@uk-data-atlas/measures";

import type { GeographyInventory } from "@uk-data-atlas/relationships";
import type { GeometrySourceRegistry } from "@uk-data-atlas/geometry";
import type { RelationshipCandidateInventory } from "@uk-data-atlas/relationships";
import {
	isMeasureTable,
	type AnyMeasureObservationArtifact,
	type ExportManifest,
} from "@uk-data-atlas/catalogue/node";
import { tableMeasureObservations } from "@uk-data-atlas/measures";
import { compileValidationReport } from "./compileValidationReport.ts";
import { readMeasureTotals, readValidationWaivers } from "./inputs.ts";
import { readStoredText, storedTextExists } from "@uk-data-atlas/artifacts";
import { artifactDirectory, configDirectory } from "@uk-data-atlas/atlas-db";
import { createCrosswalkArtifacts } from "../storage/crosswalkArtifacts.ts";
import { openStatisticsArtifactReader } from "../statistics/statisticsArtifacts.ts";

export const buildValidationReport = (repositoryRoot: string) => {
	const outputDirectory = artifactDirectory(repositoryRoot);
	const read = <T>(path: string): T => {
		const fullPath = buildArtifactPath(repositoryRoot, path);
		if (!storedTextExists(fullPath)) {
			throw new Error(`Build ${path} before the validation report.`);
		}
		return JSON.parse(readStoredText(fullPath)) as T;
	};
	const areaInventory = read<AreaInventory>("area-inventory.json");
	const crosswalkInventory = read<CrosswalkInventory>(
		"crosswalk-inventory.json",
	);
	const exportManifest = read<ExportManifest>("export-manifest.json");
	const dataCatalog = read<DataCatalog>("data-catalog.json");
	const { database, readArtifact } = openStatisticsArtifactReader(
		repositoryRoot,
		dataCatalog,
	);
	try {
		const report = compileValidationReport({
			boundaryRegistry: read<BoundaryRegistry>("boundary-releases.json"),
			areaInventory,
			areaArtifacts: areaInventory.releases.flatMap((release) =>
				release.status === "available"
					? [read<AreaReleaseArtifact>(release.artifact)]
					: [],
			),
			geometrySources: read<GeometrySourceRegistry>(
				"geometry-sources.json",
			),
			crosswalkInventory,
			crosswalkArtifacts: createCrosswalkArtifacts(
				outputDirectory,
				crosswalkInventory,
			),
			relationshipCandidates: read<RelationshipCandidateInventory>(
				"relationship-candidates.json",
			),
			geographyInventory: read<GeographyInventory>(
				"geography-inventory.json",
			),
			dataCatalog,
			exportManifest,
			observationArtifacts: Object.fromEntries(
				exportManifest.exports.map((entry) => {
					const measure = dataCatalog.measures.find(
						(candidate) => candidate.id === entry.measureId,
					);
					const source = measure?.sources.find(
						(candidate) =>
							candidate.datasetId === entry.datasetId &&
							candidate.sourceGeography.type ===
								entry.sourceGeography.type &&
							candidate.sourceGeography.boundaryYear ===
								entry.sourceGeography.boundaryYear,
					);
					if (!measure || !source)
						throw new Error(
							`No catalogue source for export ${entry.id}.`,
						);
					const artifact: unknown = JSON.parse(
						readArtifact(measure.id, source),
					);
					return [
						entry.id,
						isMeasureTable(artifact)
							? tableMeasureObservations(artifact, measure.id)
							: (artifact as AnyMeasureObservationArtifact),
					];
				}),
			),
			...readMeasureTotals(
				join(configDirectory(repositoryRoot), "measure-totals.json"),
			),
			...readValidationWaivers(
				join(
					configDirectory(repositoryRoot),
					"validation-waivers.json",
				),
			),
		});
		const reportPath = join(outputDirectory, "validation-report.json");
		writeFileSync(reportPath, `${JSON.stringify(report, null, "\t")}\n`);
		return { reportPath, summary: report.summary };
	} finally {
		database.close();
	}
};
