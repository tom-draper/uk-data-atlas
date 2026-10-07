import { readFileSync } from "node:fs";
import type { AnalysisGeographyInventory } from "./analysisGeographies";
import type { AnalysisGeographyValidationInventory } from "./analysisGeographyValidation";
import type { AtlasRelease } from "./atlasRelease";
import type { CrosswalkInventory } from "./crosswalkInventory";
import type { DataCatalog } from "./dataCatalog";
import type { ExportManifest } from "./exportManifest";
import type { LookupManifest } from "./lookupExports";
import type { MeasureCompatibilityInventory } from "./measureCompatibility";
import {
	openapiDocumentHash,
	type OperationsArtifact,
} from "./operationTemplates";
import type { ValidationReport } from "./validationReport";
import { withUnitDefinitions } from "./unitRegistry";
import { publicPath, readPublicManifest } from "./publicManifest";

export const readAtlasRelease = (apiRoot: string): AtlasRelease =>
	readPublicManifest<AtlasRelease>(
		apiRoot,
		"atlas-release.json",
		"artifacts",
		"atlas release manifest",
	);

/**
 * The operations compiled from `openapiDocument`. One compiled from an older
 * document is refused: it would answer a newly declared parameter with 400.
 */
export const readOperations = (
	apiRoot: string,
	openapiDocument: string,
): OperationsArtifact => {
	const artifact = readPublicManifest<OperationsArtifact>(
		apiRoot,
		"operations.json",
		"operations",
		"operations artifact",
	);
	if (
		artifact.inputs?.openapiDocument !==
		openapiDocumentHash(openapiDocument)
	) {
		throw new Error(
			`${publicPath(apiRoot, "operations.json")} was compiled from another openapi.yaml; run pnpm build:operations.`,
		);
	}
	return artifact;
};

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
