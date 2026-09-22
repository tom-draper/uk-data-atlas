import { readFileSync } from "node:fs";

export type CrosswalkSideAdapter = {
	geography: string;
	boundaryRelease: string;
	codeProperty: string;
	nameProperty: string;
	aliasProperty?: string;
};

export type CrosswalkMethod =
	| "official-lookup"
	| "clean-containment"
	| "area-overlap"
	| "same-code-continuity";
export type CrosswalkQuality = "publisher-supplied" | "derived";
export type PropertyRelationshipPurpose = "identity" | "membership";
export type AreaOverlapWeighting = {
	status: "provided";
	basis: "area";
	normalisation: "per-source";
};
export type CrosswalkWeighting =
	| { status: "not-provided" }
	| { status: "not-applicable" }
	| AreaOverlapWeighting;

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
};

// Area-overlap adapters intersect two compiled releases' geometries, read
// from the geometry source registry rather than declared here.
export type AreaOverlapCrosswalkAdapter = {
	id: string;
	method: "area-overlap";
	quality: "derived";
	weighting: AreaOverlapWeighting;
	from: { geography: string; boundaryRelease: string };
	to: { geography: string; boundaryRelease: string };
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
	from: { geography: string; boundaryRelease: string };
	to: { geography: string; boundaryRelease: string };
	/**
	 * The sliver width, as area-overlap adapters declare it: a pair is
	 * identity while its widest difference is under half of it.
	 */
	sliverWidthM: number;
};

export type CrosswalkAdapter =
	| PropertyCrosswalkAdapter
	| AreaOverlapCrosswalkAdapter
	| SameCodeContinuityCrosswalkAdapter;

type AdapterFile = { schemaVersion?: unknown; crosswalks?: unknown };

const PROPERTY_METHODS = ["official-lookup", "clean-containment"];
const PROPERTY_WEIGHTING_STATUSES = ["not-provided", "not-applicable"];
const PROPERTY_RELATIONSHIP_PURPOSES = ["identity", "membership"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const hasStrings = (value: unknown, keys: string[]) =>
	isRecord(value) && keys.every((key) => typeof value[key] === "string");

const validSide = (side: unknown): side is CrosswalkSideAdapter =>
	hasStrings(side, [
		"geography",
		"boundaryRelease",
		"codeProperty",
		"nameProperty",
	]) &&
	((side as { aliasProperty?: unknown }).aliasProperty === undefined ||
		typeof (side as { aliasProperty?: unknown }).aliasProperty ===
			"string");

const validPropertyAdapter = (
	adapter: Record<string, unknown>,
): adapter is PropertyCrosswalkAdapter =>
	typeof adapter.input === "string" &&
	PROPERTY_METHODS.includes(adapter.method as string) &&
	adapter.quality === "publisher-supplied" &&
	(adapter.relationshipPurpose === undefined ||
		PROPERTY_RELATIONSHIP_PURPOSES.includes(
			adapter.relationshipPurpose as string,
		)) &&
	isRecord(adapter.weighting) &&
	PROPERTY_WEIGHTING_STATUSES.includes(adapter.weighting.status as string) &&
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
	hasStrings(adapter.from, ["geography", "boundaryRelease"]) &&
	hasStrings(adapter.to, ["geography", "boundaryRelease"]) &&
	(adapter.sourceCodePattern === undefined ||
		typeof adapter.sourceCodePattern === "string") &&
	typeof adapter.sliverWidthM === "number" &&
	adapter.sliverWidthM > 0 &&
	typeof adapter.minimumCoverage === "number" &&
	adapter.minimumCoverage > 0 &&
	adapter.minimumCoverage <= 1;

const validSameCodeContinuityAdapter = (
	adapter: Record<string, unknown>,
): adapter is SameCodeContinuityCrosswalkAdapter =>
	adapter.method === "same-code-continuity" &&
	adapter.quality === "derived" &&
	adapter.relationshipPurpose === "identity" &&
	isRecord(adapter.weighting) &&
	adapter.weighting.status === "not-applicable" &&
	hasStrings(adapter.from, ["geography", "boundaryRelease"]) &&
	hasStrings(adapter.to, ["geography", "boundaryRelease"]) &&
	(adapter.from as { geography: string }).geography ===
		(adapter.to as { geography: string }).geography &&
	(adapter.from as { boundaryRelease: string }).boundaryRelease !==
		(adapter.to as { boundaryRelease: string }).boundaryRelease &&
	typeof adapter.sliverWidthM === "number" &&
	adapter.sliverWidthM > 0;

export const readCrosswalkAdapters = (path: string): CrosswalkAdapter[] => {
	const file = JSON.parse(readFileSync(path, "utf8")) as AdapterFile;
	if (file.schemaVersion !== 1 || !Array.isArray(file.crosswalks)) {
		throw new Error(`Invalid crosswalk adapter manifest at ${path}`);
	}
	return file.crosswalks.map((adapter: unknown) => {
		if (
			!isRecord(adapter) ||
			typeof adapter.id !== "string" ||
			!(
				validPropertyAdapter(adapter) ||
				validAreaOverlapAdapter(adapter) ||
				validSameCodeContinuityAdapter(adapter)
			)
		) {
			throw new Error(`Invalid crosswalk adapter at ${path}`);
		}
		return adapter;
	});
};
