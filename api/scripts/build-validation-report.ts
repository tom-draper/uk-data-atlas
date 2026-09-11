import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AreaInventory, AreaReleaseArtifact } from "../src/areaInventory";
import type { BoundaryRegistry } from "../src/boundaryRegistry";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "../src/crosswalkInventory";
import type { GeographyInventory } from "../src/geographyInventory";
import type { GeometrySourceRegistry } from "../src/geometrySourceRegistry";
import type { RelationshipCandidateInventory } from "../src/relationshipCandidates";
import {
	compileValidationReport,
	readValidationWaivers,
} from "../src/validationReport";

export const buildValidationReport = (repositoryRoot: string) => {
	const outputDirectory = join(repositoryRoot, "api", "public");
	const read = <T>(path: string): T => {
		const fullPath = join(outputDirectory, path);
		if (!existsSync(fullPath)) {
			throw new Error(`Build ${path} before the validation report.`);
		}
		return JSON.parse(readFileSync(fullPath, "utf8")) as T;
	};
	const areaInventory = read<AreaInventory>("area-inventory.json");
	const crosswalkInventory = read<CrosswalkInventory>(
		"crosswalk-inventory.json",
	);
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
		...readValidationWaivers(
			join(repositoryRoot, "api", "config", "validation-waivers.json"),
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
