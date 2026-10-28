export * from "./analysisGeographies";
export * from "./analysisGeographyValidation";
export * from "./areaAbsence";
export * from "./areaAdapters";
export * from "./areaLookup";
export {
	borderIndex,
	sharedBorder,
	sharedBorderWith,
	type BorderIndex,
	type Neighbour,
	type Touch,
} from "@uk-data-atlas/geometry";
export * from "./areaResources";
export * from "./areaSearch";
export * from "./areaSearchCompiler";
export * from "./areaSourceAdapters";
export * from "./batchValidation";
export * from "./boundaryLoader";
export * from "./boundaryResources";
export * from "./capability";
export * from "./catalog/countries";
export * from "./countryRelease";
export * from "@uk-data-atlas/areas";
export * from "./fullDetailDownloads";
export * from "./geoJsonProperties";
export * from "./geographyBuildPath";
export * from "./geographyInventory";
export * from "./geographyResolver";
export * from "./lookupExports";
export * from "./rankCompatibilityReleases";
export * from "./rawAreaGeometries";
export {
	relatedCodesOf,
	addRelatedCodes,
	releaseCoverageOf,
	type RelatedCodesByRelease,
	type ReleaseCoverage,
} from "@uk-data-atlas/relationships";
export * from "./releaseForDate";
export type { CrosswalkLookup } from "@uk-data-atlas/relationships";
export * from "./sourceExactProvenance";
export * from "./resolver/areas";
export * from "./resolver/capability";
export * from "./resolver/catalogue";
export * from "./resolver/conversionCapability";
export * from "./resolver/lineage";
export * from "./resolver/locations";
export { compareBoundaryReleases as compareReleaseEvidence } from "./resolver/releaseComparison";
export type {
	BoundaryExtentChange,
	RecodedArea,
	PublishedRelationshipMapping,
	BoundaryReleaseComparison,
	ReleaseComparisonSources,
} from "./resolver/releaseComparison";
export * from "./resolver/spatial";
