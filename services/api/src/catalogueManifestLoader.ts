import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AnalysisGeographyInventory } from "./analysisGeographies";
import type { AnalysisGeographyValidationInventory } from "./analysisGeographyValidation";
import type { AtlasRelease } from "./atlasRelease";
import type { CrosswalkInventory } from "./crosswalkInventory";
import type { DataCatalog } from "./dataCatalog";
import type { ExportManifest } from "./exportManifest";
import type { LookupManifest } from "./lookupExports";
import type { MeasureCompatibilityInventory } from "./measureCompatibility";
import type { ValidationReport } from "./validationReport";
import { withUnitDefinitions } from "./unitRegistry";

const publicPath = (apiRoot: string, filename: string) =>
	join(apiRoot, "public", filename);

export const readAtlasRelease = (apiRoot: string): AtlasRelease => {
	const path = publicPath(apiRoot, "atlas-release.json");
	const release = JSON.parse(readFileSync(path, "utf8")) as AtlasRelease;
	if (release.schemaVersion !== 1 || !Array.isArray(release.artifacts)) {
		throw new Error(`Invalid atlas release manifest at ${path}`);
	}
	return release;
};

export const readValidationReport = (apiRoot: string): ValidationReport => {
	const path = publicPath(apiRoot, "validation-report.json");
	const report = JSON.parse(readFileSync(path, "utf8")) as ValidationReport;
	if (report.schemaVersion !== 1 || !Array.isArray(report.resources)) {
		throw new Error(`Invalid validation report at ${path}`);
	}
	return report;
};

export const readDataCatalog = (apiRoot: string): DataCatalog => {
	const path = publicPath(apiRoot, "data-catalog.json");
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

export const readExportManifest = (apiRoot: string): ExportManifest => {
	const path = publicPath(apiRoot, "export-manifest.json");
	const manifest = JSON.parse(readFileSync(path, "utf8")) as ExportManifest;
	if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.exports)) {
		throw new Error(`Invalid export manifest at ${path}`);
	}
	return manifest;
};

export const readLookupManifest = (apiRoot: string): LookupManifest => {
	const path = publicPath(apiRoot, "lookup-manifest.json");
	const manifest = JSON.parse(readFileSync(path, "utf8")) as LookupManifest;
	if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.lookups)) {
		throw new Error(`Invalid lookup manifest at ${path}`);
	}
	return manifest;
};

export const readMeasureCompatibility = (
	apiRoot: string,
): MeasureCompatibilityInventory => {
	const path = publicPath(apiRoot, "measure-compatibility.json");
	const inventory = JSON.parse(
		readFileSync(path, "utf8"),
	) as MeasureCompatibilityInventory;
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.measures)) {
		throw new Error(`Invalid measure compatibility inventory at ${path}`);
	}
	return inventory;
};

export const readAnalysisGeographyInventory = (
	apiRoot: string,
	dataCatalog: DataCatalog,
	crosswalkInventory: CrosswalkInventory,
): AnalysisGeographyInventory => {
	const path = publicPath(apiRoot, "analysis-geographies.json");
	const inventory = JSON.parse(
		readFileSync(path, "utf8"),
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
	apiRoot: string,
	analysisGeographies: AnalysisGeographyInventory,
	dataCatalog: DataCatalog,
	crosswalkInventory: CrosswalkInventory,
): AnalysisGeographyValidationInventory => {
	const path = publicPath(apiRoot, "analysis-geography-validation.json");
	const inventory = JSON.parse(
		readFileSync(path, "utf8"),
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
