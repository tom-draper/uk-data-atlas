import { readFileSync } from "node:fs";

export type CrosswalkSideAdapter = {
	geography: string;
	boundaryRelease: string;
	codeProperty: string;
	nameProperty: string;
	aliasProperty?: string;
};

export type CrosswalkMethod = "official-lookup" | "clean-containment";
export type CrosswalkQuality = "publisher-supplied";
export type CrosswalkWeighting =
	{ status: "not-provided" } | { status: "not-applicable" };

export type CrosswalkAdapter = {
	id: string;
	input: string;
	method: CrosswalkMethod;
	quality: CrosswalkQuality;
	weighting: CrosswalkWeighting;
	from: CrosswalkSideAdapter;
	to: CrosswalkSideAdapter;
};

type AdapterFile = { schemaVersion?: unknown; crosswalks?: unknown };

const METHODS: CrosswalkMethod[] = ["official-lookup", "clean-containment"];
const QUALITIES: CrosswalkQuality[] = ["publisher-supplied"];
const WEIGHTING_STATUSES = ["not-provided", "not-applicable"];

const validSide = (side: unknown): side is CrosswalkSideAdapter =>
	typeof side === "object" &&
	side !== null &&
	["geography", "boundaryRelease", "codeProperty", "nameProperty"].every(
		(key) => typeof (side as Record<string, unknown>)[key] === "string",
	) &&
	((side as { aliasProperty?: unknown }).aliasProperty === undefined ||
		typeof (side as { aliasProperty?: unknown }).aliasProperty ===
			"string");

const validWeighting = (weighting: unknown): weighting is CrosswalkWeighting =>
	typeof weighting === "object" &&
	weighting !== null &&
	WEIGHTING_STATUSES.includes(
		(weighting as { status?: unknown }).status as string,
	);

export const readCrosswalkAdapters = (path: string): CrosswalkAdapter[] => {
	const file = JSON.parse(readFileSync(path, "utf8")) as AdapterFile;
	if (file.schemaVersion !== 1 || !Array.isArray(file.crosswalks)) {
		throw new Error(`Invalid crosswalk adapter manifest at ${path}`);
	}
	return file.crosswalks.map((adapter) => {
		if (
			typeof adapter !== "object" ||
			adapter === null ||
			typeof (adapter as CrosswalkAdapter).id !== "string" ||
			typeof (adapter as CrosswalkAdapter).input !== "string" ||
			!METHODS.includes((adapter as CrosswalkAdapter).method) ||
			!QUALITIES.includes((adapter as CrosswalkAdapter).quality) ||
			!validWeighting((adapter as CrosswalkAdapter).weighting) ||
			!validSide((adapter as CrosswalkAdapter).from) ||
			!validSide((adapter as CrosswalkAdapter).to)
		) {
			throw new Error(`Invalid crosswalk adapter at ${path}`);
		}
		return adapter as CrosswalkAdapter;
	});
};
