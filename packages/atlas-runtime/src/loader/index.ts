export * from "./fullDetailDownloads.ts";
export * from "./geographyResolver.ts";
export * from "./coveragePlan.ts";
export * from "./measureCapability.ts";
export * from "./measureContext.ts";
export * from "./relationshipRepairs.ts";
export * from "./catalogueLoader.ts";
export * from "./catalogueManifestLoader.ts";
export * from "./measureValuesContext.ts";
export * from "./boundaryLoader.ts";

export * from "./areaAbsence.ts";
export * from "./areaResources.ts";
export * from "./batchValidation.ts";
export * from "./countryRelease.ts";
export * from "./geographyInventory.ts";
export * from "./postcodeAreaReleases.ts";
export * from "./rankCompatibilityReleases.ts";
export {
	relatedCodesOf,
	addRelatedCodes,
	releaseCoverageOf,
	type RelatedCodesByRelease,
	type ReleaseCoverage,
} from "@uk-data-atlas/relationships";
export type { CrosswalkLookup } from "@uk-data-atlas/relationships";
export * from "./sourceExactProvenance.ts";
export * from "./resolver/areas.ts";
export * from "./resolver/capability.ts";
export * from "./resolver/catalogue.ts";
export * from "./resolver/conversionCapability.ts";
export * from "./resolver/lineage.ts";
export * from "./resolver/locations.ts";
export { compareBoundaryReleases as compareReleaseEvidence } from "./resolver/releaseComparison.ts";
export type {
	BoundaryExtentChange,
	RecodedArea,
	PublishedRelationshipMapping,
	BoundaryReleaseComparison,
	ReleaseComparisonSources,
} from "./resolver/releaseComparison.ts";
export * from "./resolver/spatial.ts";
export * from "./resolver/postcodes.ts";
