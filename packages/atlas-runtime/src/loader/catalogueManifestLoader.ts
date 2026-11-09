import { readAtlasPayload } from "../catalogue/atlasPayloads.ts";
import { readFileSync } from "node:fs";
import type { AnalysisGeographyInventory } from "../relationships/analysisGeographies.ts";
import type { AnalysisGeographyValidationInventory } from "../catalogue/analysisGeographyValidation.ts";
import type { AtlasRelease } from "@uk-data-atlas/atlas-db";
import type { CrosswalkInventory } from "@uk-data-atlas/relationships";
import type { DataCatalog } from "@uk-data-atlas/measures";
import type { ExportManifest } from "../catalogue/exportManifest.ts";
import type { LookupManifest } from "../areas/lookupExports.ts";
import type { MeasureCompatibilityInventory } from "@uk-data-atlas/measures";
import type { ValidationReport } from "../catalogue/validationReport.ts";
import { withUnitDefinitions } from "@uk-data-atlas/measures";
import { publicPath, readPublicManifest } from "@uk-data-atlas/atlas-db";

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

export const readDataCatalog = (repositoryRoot: string): DataCatalog => {
	const path = publicPath(repositoryRoot, "data-catalog.json");
	const catalog = JSON.parse(readFileSync(path, "utf8")) as DataCatalog;
	if (
		catalog.schemaVersion !== 1 ||
		!Array.isArray(catalog.datasets) ||
		!Array.isArray(catalog.measures)
	) {
		throw new Error(`Invalid data catalogue at ${path}`);
	}
	return withUnitDefinitions(catalog);
};

export const readExportManifest = (repositoryRoot: string): ExportManifest =>
	readPublicManifest<ExportManifest>(
		repositoryRoot,
		"export-manifest.json",
		"exports",
		"export manifest",
	);

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
