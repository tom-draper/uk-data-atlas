import { readAtlasPayload } from "@uk-data-atlas/catalogue/node";
import type { AnalysisGeographyInventory } from "@uk-data-atlas/relationships";
import type { AnalysisGeographyValidationInventory } from "@uk-data-atlas/catalogue/node";
import type { AtlasRelease } from "@uk-data-atlas/atlas-db";
import type { CrosswalkInventory } from "@uk-data-atlas/relationships";
import type { DataCatalog } from "@uk-data-atlas/measures";
import type { ExportManifest } from "@uk-data-atlas/catalogue/node";
import type { LookupManifest } from "@uk-data-atlas/areas";
import type { MeasureCompatibilityInventory } from "@uk-data-atlas/measures";
import type { ValidationReport } from "@uk-data-atlas/catalogue/node";
import { readPublicManifest } from "@uk-data-atlas/atlas-db";
import { publicPath } from "@uk-data-atlas/atlas-db";
import { readFileSync } from "node:fs";
import { sha256 } from "@uk-data-atlas/artifacts";

export const readAtlasRelease = (repositoryRoot: string): AtlasRelease =>
	readPublicManifest<AtlasRelease>(
		repositoryRoot,
		"atlas-release.json",
		"artifacts",
		"atlas release manifest",
	);

export const readValidationReport = (
	repositoryRoot: string,
): ValidationReport =>
	readPublicManifest<ValidationReport>(
		repositoryRoot,
		"validation-report.json",
		"resources",
		"validation report",
	);

export const readExportManifest = (
	repositoryRoot: string,
	release?: AtlasRelease,
) => {
	const path = publicPath(repositoryRoot, "export-manifest.json");
	const text = readFileSync(path, "utf8");
	const manifest = JSON.parse(text) as ExportManifest;
	if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.exports))
		throw new Error(`Invalid export manifest at ${path}`);
	const expected = release?.artifacts.find(
		({ id }) => id === "export-manifest",
	)?.contentHash;
	return {
		manifest,
		matchesRelease: expected !== undefined && sha256(text) === expected,
	};
};

export const readLookupManifest = (repositoryRoot: string): LookupManifest =>
	readPublicManifest<LookupManifest>(
		repositoryRoot,
		"lookup-manifest.json",
		"lookups",
		"lookup manifest",
	);

export const readMeasureCompatibility = (
	repositoryRoot: string,
): MeasureCompatibilityInventory =>
	readPublicManifest<MeasureCompatibilityInventory>(
		repositoryRoot,
		"measure-compatibility.json",
		"measures",
		"measure compatibility inventory",
	);

export const readAnalysisGeographyInventory = (
	repositoryRoot: string,
	dataCatalog: DataCatalog,
	crosswalkInventory: CrosswalkInventory,
): AnalysisGeographyInventory => {
	const path = "data/build/atlas.sqlite:analysis-geographies";
	const inventory = JSON.parse(
		readAtlasPayload(repositoryRoot, "analysis-geographies"),
	) as AnalysisGeographyInventory;
	if (
		inventory.schemaVersion !== 1 ||
		!Array.isArray(inventory.supports) ||
		inventory.dataCatalogHash !== dataCatalog.contentHash ||
		inventory.crosswalkInventoryHash !== crosswalkInventory.contentHash
	) {
		throw new Error(`Invalid analysis geography inventory at ${path}`);
	}
	return inventory;
};

export const readAnalysisGeographyValidationInventory = (
	repositoryRoot: string,
	analysisGeographies: AnalysisGeographyInventory,
	dataCatalog: DataCatalog,
	crosswalkInventory: CrosswalkInventory,
): AnalysisGeographyValidationInventory => {
	const path = "data/build/atlas.sqlite:analysis-geography-validation";
	const inventory = JSON.parse(
		readAtlasPayload(repositoryRoot, "analysis-geography-validation"),
	) as AnalysisGeographyValidationInventory;
	if (
		inventory.schemaVersion !== 1 ||
		!Array.isArray(inventory.supports) ||
		inventory.analysisGeographyInventoryHash !==
			analysisGeographies.contentHash ||
		inventory.dataCatalogHash !== dataCatalog.contentHash ||
		inventory.crosswalkInventoryHash !== crosswalkInventory.contentHash
	) {
		throw new Error(
			`Invalid analysis geography validation inventory at ${path}`,
		);
	}
	return inventory;
};
