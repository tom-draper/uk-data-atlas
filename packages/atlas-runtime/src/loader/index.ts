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
export { findArea, areaMeasureSources } from "@uk-data-atlas/measures";
export {
	MAX_BATCH_VALUES,
	validateBatch,
	summariseBatch,
	type AreaRef,
	type ParentMatch,
	type ValidatedValue,
} from "@uk-data-atlas/relationships";
export * from "./countryRelease.ts";
export type {
	GeographyRelationship,
	GeographyReleaseInventory,
	GeographyInventory,
} from "@uk-data-atlas/relationships";
export * from "./postcodeAreaReleases.ts";
export { rankReleases } from "@uk-data-atlas/measures";
export {
	relatedCodesOf,
	addRelatedCodes,
	releaseCoverageOf,
	type RelatedCodesByRelease,
	type ReleaseCoverage,
} from "@uk-data-atlas/relationships";
export type { CrosswalkLookup } from "@uk-data-atlas/relationships";
export * from "./resolver/areas.ts";
export * from "./resolver/capability.ts";
export * from "./resolver/catalogue.ts";
export {
	RELATIONSHIP_OPERATIONS,
	assessPathTrust,
	rankResolvedPaths,
	capabilityStatus,
	planConversion,
	buildConversionReach,
	ConversionCapabilities,
	type RelationshipPathStepCoverage,
	type ResolvedRelationshipPath,
	type RelationshipOperation,
	type RelationshipPrerequisite,
	type ResolvedRelationshipCapability,
	type ResolvedConversionPlan,
	type GeographyReach,
	type ConversionCapabilityInputs,
} from "@uk-data-atlas/relationships";
export * from "./resolver/lineage.ts";
export * from "./resolver/locations.ts";
export { compareReleaseEvidence } from "@uk-data-atlas/relationships";
export type {
	BoundaryExtentChange,
	RecodedArea,
	PublishedRelationshipMapping,
	BoundaryReleaseComparison,
	ReleaseComparisonSources,
} from "@uk-data-atlas/relationships";
export * from "./resolver/spatial.ts";
export * from "./resolver/postcodes.ts";

export { PostcodeResolver } from "./resolver/postcodes.ts";
export type { AreaValidation } from "./resolver/areaValidation.ts";
