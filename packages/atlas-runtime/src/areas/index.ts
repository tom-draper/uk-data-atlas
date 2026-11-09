export * from "./analysisGeographies.ts";
export * from "./analysisGeographyValidation.ts";
export * from "./areaAbsence.ts";
export * from "./areaAdapters.ts";
export * from "./areaLookup.ts";
export {
	borderIndex,
	sharedBorder,
	sharedBorderWith,
	type BorderIndex,
	type Neighbour,
	type Touch,
} from "@uk-data-atlas/geometry";
export * from "./areaResources.ts";
export * from "./areaSearch.ts";
export * from "./areaSearchCompiler.ts";
export * from "./areaSourceAdapters.ts";
export * from "./atlasAreaReader.ts";
export * from "./batchValidation.ts";
export * from "./boundaryLoader.ts";
export * from "./boundaryResources.ts";
export * from "./capability.ts";
export * from "./catalog/countries.ts";
export * from "./countryRelease.ts";
export * from "@uk-data-atlas/areas";
export * from "./geographyBuildPath.ts";
export * from "./geographyInventory.ts";
export * from "./lookupExports.ts";
export * from "./postcodeAreaReleases.ts";
export * from "./rankCompatibilityReleases.ts";
export * from "./rawAreaGeometries.ts";
export {
	relatedCodesOf,
	addRelatedCodes,
	releaseCoverageOf,
	type RelatedCodesByRelease,
	type ReleaseCoverage,
} from "@uk-data-atlas/relationships";
export * from "./releaseForDate.ts";
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
