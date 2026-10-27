import {
	observationDatabasePath,
	assertObservationCatalogue,
} from "../../shared/atlasObservations";
import { buildArtifactPath } from "../../shared/geographyBuildPath";
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
	AreaInventory,
	AreaReleaseArtifact,
} from "../../shared/areaInventory";
import type { BoundaryRegistry } from "../../shared/boundaryRegistry";
import type { CrosswalkArtifact } from "../../shared/crosswalkTypes";
import type { CrosswalkInventory } from "../../shared/crosswalkInventory";
import type { DataCatalog } from "../../shared/dataCatalog";
import type { ExportManifest } from "../../shared/exportManifest";
import type { GeographyInventory } from "../../shared/geographyInventory";
import type { GeometrySourceRegistry } from "../../shared/geometrySourceRegistry";
import type { RelationshipCandidateInventory } from "../../shared/relationshipCandidates";
import { readSourceObservations } from "../../shared/observationTables";
import { compileValidationReport } from "./validation/compileValidationReport";
import { readMeasureTotals, readValidationWaivers } from "./validation/inputs";
import { readStoredText, storedTextExists } from "../../shared/storedText";
import {
	apiRootOf,
	artifactDirectory,
	configDirectory,
} from "../../shared/dataLayout";

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
	const databasePath = observationDatabasePath(apiRootOf(repositoryRoot));
	assertObservationCatalogue(databasePath, dataCatalog);
	const report = compileValidationReport({
		boundaryRegistry: read<BoundaryRegistry>("boundary-releases.json"),
		areaInventory,
		areaArtifacts: areaInventory.releases.flatMap((release) =>
			release.status === "available"
				? [read<AreaReleaseArtifact>(release.artifact)]
				: [],
		),
		geometrySources: read<GeometrySourceRegistry>("geometry-sources.json"),
		crosswalkInventory,
		crosswalkArtifacts: crosswalkInventory.crosswalks.map((crosswalk) =>
			read<CrosswalkArtifact>(crosswalk.artifact),
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
			exportManifest.exports.map((entry) => [
				entry.id,
				readSourceObservations(
					databasePath,
					entry.artifact,
					entry.measureId,
				),
			]),
		),
		...readMeasureTotals(
			join(configDirectory(repositoryRoot), "measure-totals.json"),
		),
		...readValidationWaivers(
			join(configDirectory(repositoryRoot), "validation-waivers.json"),
		),
	});
	const reportPath = join(outputDirectory, "validation-report.json");
	writeFileSync(reportPath, `${JSON.stringify(report, null, "\t")}\n`);
	return { reportPath, summary: report.summary };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const { reportPath, summary } = buildValidationReport(repositoryRoot);
	console.log(
		`Wrote ${summary.checkCount} checks over ${summary.resourceCount} resources (${summary.waivedCount} waived) to ${reportPath}`,
	);
}
