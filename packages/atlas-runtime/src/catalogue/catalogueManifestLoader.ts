import { readAtlasPayload } from "../storage/atlasSqlite";
import { readFileSync } from "node:fs";
import type { AnalysisGeographyInventory } from "../areas/analysisGeographies";
import type { AnalysisGeographyValidationInventory } from "../areas/analysisGeographyValidation";
import type { AtlasRelease } from "../storage/atlasRelease";
import type { CrosswalkInventory } from "@uk-data-atlas/relationships";
import type { DataCatalog } from "@uk-data-atlas/measures";
import type { ExportManifest } from "../storage/exportManifest";
import type { LookupManifest } from "../areas/lookupExports";
import type { MeasureCompatibilityInventory } from "@uk-data-atlas/measures";
import type { ValidationReport } from "./validationReport";
import { withUnitDefinitions } from "@uk-data-atlas/measures";
import { publicPath, readPublicManifest } from "../storage/publicManifest";
import { repositoryRootOf } from "../storage/dataLayout";

export const readAtlasRelease = (apiRoot: string): AtlasRelease =>
	readPublicManifest<AtlasRelease>(
		apiRoot,
		"atlas-release.json",
		"artifacts",
		"atlas release manifest",
	);

export const readValidationReport = (apiRoot: string): ValidationReport =>
	readPublicManifest<ValidationReport>(
		apiRoot,
		"validation-report.json",
		"resources",
		"validation report",
	);

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

export const readExportManifest = (apiRoot: string): ExportManifest =>
	readPublicManifest<ExportManifest>(
		apiRoot,
		"export-manifest.json",
		"exports",
		"export manifest",
	);

export const readLookupManifest = (apiRoot: string): LookupManifest =>
	readPublicManifest<LookupManifest>(
		apiRoot,
		"lookup-manifest.json",
		"lookups",
		"lookup manifest",
	);

export const readMeasureCompatibility = (
	apiRoot: string,
): MeasureCompatibilityInventory =>
	readPublicManifest<MeasureCompatibilityInventory>(
		apiRoot,
		"measure-compatibility.json",
		"measures",
		"measure compatibility inventory",
	);

export const readAnalysisGeographyInventory = (
	apiRoot: string,
	dataCatalog: DataCatalog,
	crosswalkInventory: CrosswalkInventory,
): AnalysisGeographyInventory => {
	const path = "data/build/atlas.sqlite:analysis-geographies";
	const inventory = JSON.parse(
		readAtlasPayload(repositoryRootOf(apiRoot), "analysis-geographies"),
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
	const path = "data/build/atlas.sqlite:analysis-geography-validation";
	const inventory = JSON.parse(
		readAtlasPayload(
			repositoryRootOf(apiRoot),
			"analysis-geography-validation",
		),
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
