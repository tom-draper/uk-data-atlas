import { readFileSync } from "node:fs";
import { isGeographyKind, type GeographyKind } from "./geography";

export type CrosswalkSideAdapter = {
	geography: GeographyKind;
	boundaryRelease: string;
	codeProperty: string;
	nameProperty: string;
	aliasProperty?: string;
};

export type CrosswalkMethod =
	| "official-lookup"
	| "clean-containment"
	| "area-overlap"
	| "population-overlap"
	| "geometric-containment"
	| "same-code-continuity";
export type CrosswalkQuality = "publisher-supplied" | "derived";
export type PropertyRelationshipPurpose = "identity" | "membership";
export type AreaOverlapWeighting = {
	status: "provided";
	basis: "area";
	normalisation: "per-source";
};
/**
 * Weights from resident population rather than land: each source's people,
 * counted from fine building blocks split by area, divided among its targets.
 * The denominator and its date travel with every weighted answer.
 */
export type PopulationOverlapWeighting = {
	status: "provided";
	basis: "population";
	normalisation: "per-source";
	/** What was counted, such as Census 2021 usual residents. */
	population: string;
	/** The reference date of the count. */
	date: string;
	/** The building blocks the count was published for. */
	blocks: { geography: GeographyKind; boundaryRelease: string };
};
export type CrosswalkWeighting =
	| { status: "not-provided" }
	| { status: "not-applicable" }
	| AreaOverlapWeighting
	| PopulationOverlapWeighting;

// Property adapters read an explicit source/target code pair from each
// feature of one published file.
export type PropertyCrosswalkAdapter = {
	id: string;
	input: string;
	method: "official-lookup" | "clean-containment";
	quality: "publisher-supplied";
	/**
	 * A publisher lookup can describe historical identity or administrative
	 * membership. Official lookups default to identity for compatibility.
	 */
	relationshipPurpose?: PropertyRelationshipPurpose;
	weighting: { status: "not-provided" } | { status: "not-applicable" };
	from: CrosswalkSideAdapter;
	to: CrosswalkSideAdapter;
	/**
	 * The column holding ONS's change indicator for each pair, as its code
	 * change lookups publish it: U unchanged, S split, M merged, X complex.
	 */
	changeProperty?: string;
	/** Reviewed fixes for a publisher-supplied target code in a property lookup. */
	targetCodeCorrections?: Record<
		string,
		{
			publishedTargetCode: string;
			correctedTargetCode: string;
			reason: string;
		}
	>;
};

// Area-overlap adapters intersect two compiled releases' geometries, read
// from the geometry source registry rather than declared here.
export type AreaOverlapCrosswalkAdapter = {
	id: string;
	method: "area-overlap";
	quality: "derived";
	weighting: AreaOverlapWeighting;
	from: { geography: GeographyKind; boundaryRelease: string };
	to: { geography: GeographyKind; boundaryRelease: string };
	/** Limit a derived relationship to an explicit, documented source code set. */
	sourceCodePattern?: string;
	sliverWidthM: number;
	minimumCoverage: number;
};

// Same-code continuity adapters pair the codes two releases of one geography
// share, and publish a pair as identity only where its two geometries differ
// by no more than generalisation slivers.
export type SameCodeContinuityCrosswalkAdapter = {
	id: string;
	method: "same-code-continuity";
	quality: "derived";
	relationshipPurpose: "identity";
	weighting: { status: "not-applicable" };
	from: { geography: GeographyKind; boundaryRelease: string };
	to: { geography: GeographyKind; boundaryRelease: string };
	/**
	 * The sliver width, as area-overlap adapters declare it: a pair is
	 * identity while its widest difference is under half of it.
	 */
	sliverWidthM: number;
};

// Population-overlap adapters reweight the pairs a published area-overlap
// crosswalk established, by the population of building blocks in each pair.
export type PopulationOverlapCrosswalkAdapter = {
	id: string;
	method: "population-overlap";
	quality: "derived";
	weighting: PopulationOverlapWeighting;
	from: { geography: GeographyKind; boundaryRelease: string };
	to: { geography: GeographyKind; boundaryRelease: string };
	/** The area-overlap crosswalk whose source/target pairs are reweighted. */
	pairs: string;
	/** Limit the sources to those the building blocks cover. */
	sourceCodePattern?: string;
	/** A CSV under data/ with one population count per building block. */
	population: { input: string; codeColumn: string; valueColumn: string };
	/** Share of each source's population the kept pairs must hold. */
	minimumCoverage: number;
};

// Geometric-containment adapters establish a hierarchy from the geometry of
// two releases, where no publisher lookup carries it.
export type GeometricContainmentCrosswalkAdapter = {
	id: string;
	method: "geometric-containment";
	quality: "derived";
	relationshipPurpose: "membership";
	weighting: { status: "not-applicable" };
	from: { geography: GeographyKind; boundaryRelease: string };
	to: { geography: GeographyKind; boundaryRelease: string };
	/** A child reaching further than half of this beyond its parent is not within it. */
	sliverWidthM: number;
};

export type CrosswalkAdapter =
	| PropertyCrosswalkAdapter
	| AreaOverlapCrosswalkAdapter
	| PopulationOverlapCrosswalkAdapter
	| GeometricContainmentCrosswalkAdapter
	| SameCodeContinuityCrosswalkAdapter;

const PROPERTY_METHODS = ["official-lookup", "clean-containment"] as const;
const PROPERTY_WEIGHTING_STATUSES = ["not-provided", "not-applicable"] as const;
const PROPERTY_RELATIONSHIP_PURPOSES = ["identity", "membership"] as const;

const isOneOf = <Values extends readonly string[]>(
	values: Values,
	value: unknown,
): value is Values[number] =>
	typeof value === "string" &&
	values.some((candidate) => candidate === value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const hasStrings = (value: unknown, keys: string[]) =>
	isRecord(value) && keys.every((key) => typeof value[key] === "string");

const hasEndpoint = (
	value: unknown,
): value is { geography: GeographyKind; boundaryRelease: string } =>
	isRecord(value) &&
	isGeographyKind(value.geography) &&
	typeof value.boundaryRelease === "string";

const validSide = (side: unknown): side is CrosswalkSideAdapter =>
	isRecord(side) &&
	isGeographyKind(side.geography) &&
	typeof side.boundaryRelease === "string" &&
	typeof side.codeProperty === "string" &&
	typeof side.nameProperty === "string" &&
	(side.aliasProperty === undefined ||
		typeof side.aliasProperty === "string");

const validPropertyAdapter = (
	adapter: Record<string, unknown>,
): adapter is PropertyCrosswalkAdapter =>
	typeof adapter.input === "string" &&
	isOneOf(PROPERTY_METHODS, adapter.method) &&
	adapter.quality === "publisher-supplied" &&
	(adapter.relationshipPurpose === undefined ||
		isOneOf(PROPERTY_RELATIONSHIP_PURPOSES, adapter.relationshipPurpose)) &&
	isRecord(adapter.weighting) &&
	isOneOf(PROPERTY_WEIGHTING_STATUSES, adapter.weighting.status) &&
	(adapter.changeProperty === undefined ||
		typeof adapter.changeProperty === "string") &&
	(adapter.targetCodeCorrections === undefined ||
		(isRecord(adapter.targetCodeCorrections) &&
			Object.values(adapter.targetCodeCorrections).every(
				(correction) =>
					isRecord(correction) &&
					typeof correction.publishedTargetCode === "string" &&
					typeof correction.correctedTargetCode === "string" &&
					typeof correction.reason === "string" &&
					correction.reason.trim().length > 0,
			))) &&
	validSide(adapter.from) &&
	validSide(adapter.to);

const validAreaOverlapAdapter = (
	adapter: Record<string, unknown>,
): adapter is AreaOverlapCrosswalkAdapter =>
	adapter.method === "area-overlap" &&
	adapter.quality === "derived" &&
	isRecord(adapter.weighting) &&
	adapter.weighting.status === "provided" &&
	adapter.weighting.basis === "area" &&
	adapter.weighting.normalisation === "per-source" &&
	hasEndpoint(adapter.from) &&
	hasEndpoint(adapter.to) &&
	(adapter.sourceCodePattern === undefined ||
		typeof adapter.sourceCodePattern === "string") &&
	typeof adapter.sliverWidthM === "number" &&
	adapter.sliverWidthM > 0 &&
	typeof adapter.minimumCoverage === "number" &&
	adapter.minimumCoverage > 0 &&
	adapter.minimumCoverage <= 1;

const validPopulationOverlapAdapter = (
	adapter: Record<string, unknown>,
): adapter is PopulationOverlapCrosswalkAdapter =>
	adapter.method === "population-overlap" &&
	adapter.quality === "derived" &&
	isRecord(adapter.weighting) &&
	adapter.weighting.status === "provided" &&
	adapter.weighting.basis === "population" &&
	adapter.weighting.normalisation === "per-source" &&
	typeof adapter.weighting.population === "string" &&
	typeof adapter.weighting.date === "string" &&
	hasEndpoint(adapter.weighting.blocks) &&
	hasEndpoint(adapter.from) &&
	hasEndpoint(adapter.to) &&
	typeof adapter.pairs === "string" &&
	(adapter.sourceCodePattern === undefined ||
		typeof adapter.sourceCodePattern === "string") &&
	hasStrings(adapter.population, ["input", "codeColumn", "valueColumn"]) &&
	typeof adapter.minimumCoverage === "number" &&
	adapter.minimumCoverage > 0 &&
	adapter.minimumCoverage <= 1;

const validGeometricContainmentAdapter = (
	adapter: Record<string, unknown>,
): adapter is GeometricContainmentCrosswalkAdapter =>
	adapter.method === "geometric-containment" &&
	adapter.quality === "derived" &&
	adapter.relationshipPurpose === "membership" &&
	isRecord(adapter.weighting) &&
	adapter.weighting.status === "not-applicable" &&
	hasEndpoint(adapter.from) &&
	hasEndpoint(adapter.to) &&
	typeof adapter.sliverWidthM === "number" &&
	adapter.sliverWidthM > 0;

const validSameCodeContinuityAdapter = (
	adapter: Record<string, unknown>,
): adapter is SameCodeContinuityCrosswalkAdapter =>
	adapter.method === "same-code-continuity" &&
	adapter.quality === "derived" &&
	adapter.relationshipPurpose === "identity" &&
	isRecord(adapter.weighting) &&
	adapter.weighting.status === "not-applicable" &&
	hasEndpoint(adapter.from) &&
	hasEndpoint(adapter.to) &&
	adapter.from.geography === adapter.to.geography &&
	adapter.from.boundaryRelease !== adapter.to.boundaryRelease &&
	typeof adapter.sliverWidthM === "number" &&
	adapter.sliverWidthM > 0;

export const readCrosswalkAdapters = (path: string): CrosswalkAdapter[] => {
	const file: unknown = JSON.parse(readFileSync(path, "utf8"));
	if (
		!isRecord(file) ||
		file.schemaVersion !== 1 ||
		!Array.isArray(file.crosswalks)
	) {
		throw new Error(`Invalid crosswalk adapter manifest at ${path}`);
	}
	return file.crosswalks.map((adapter: unknown) => {
		if (
			!isRecord(adapter) ||
			typeof adapter.id !== "string" ||
			!(
				validPropertyAdapter(adapter) ||
				validAreaOverlapAdapter(adapter) ||
				validPopulationOverlapAdapter(adapter) ||
				validGeometricContainmentAdapter(adapter) ||
				validSameCodeContinuityAdapter(adapter)
			)
		) {
			throw new Error(`Invalid crosswalk adapter at ${path}`);
		}
		return adapter;
	});
};
