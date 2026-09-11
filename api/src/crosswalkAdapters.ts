import { readFileSync } from "node:fs";

export type CrosswalkSideAdapter = {
	geography: string;
	boundaryRelease: string;
	codeProperty: string;
	nameProperty: string;
	aliasProperty?: string;
};

export type CrosswalkMethod =
	"official-lookup" | "clean-containment" | "area-overlap";
export type CrosswalkQuality = "publisher-supplied" | "derived";
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
	sliverWidthM: number;
	minimumCoverage: number;
};

export type CrosswalkAdapter =
	PropertyCrosswalkAdapter | AreaOverlapCrosswalkAdapter;

type AdapterFile = { schemaVersion?: unknown; crosswalks?: unknown };

const PROPERTY_METHODS = ["official-lookup", "clean-containment"];
const PROPERTY_WEIGHTING_STATUSES = ["not-provided", "not-applicable"];

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
	typeof adapter.sliverWidthM === "number" &&
	adapter.sliverWidthM > 0 &&
	typeof adapter.minimumCoverage === "number" &&
	adapter.minimumCoverage > 0 &&
	adapter.minimumCoverage <= 1;

export const readCrosswalkAdapters = (path: string): CrosswalkAdapter[] => {
	const file = JSON.parse(readFileSync(path, "utf8")) as AdapterFile;
	if (file.schemaVersion !== 1 || !Array.isArray(file.crosswalks)) {
		throw new Error(`Invalid crosswalk adapter manifest at ${path}`);
	}
	return file.crosswalks.map((adapter: unknown) => {
		if (
			!isRecord(adapter) ||
			typeof adapter.id !== "string" ||
			!(validPropertyAdapter(adapter) || validAreaOverlapAdapter(adapter))
		) {
			throw new Error(`Invalid crosswalk adapter at ${path}`);
		}
		return adapter;
	});
};
