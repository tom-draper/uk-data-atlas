import { readFileSync } from "node:fs";

export type CrosswalkSideAdapter = {
	geography: string;
	boundaryRelease: string;
	codeProperty: string;
	nameProperty: string;
	aliasProperty?: string;
};

export type CrosswalkAdapter = {
	id: string;
	input: string;
	from: CrosswalkSideAdapter;
	to: CrosswalkSideAdapter;
};

type AdapterFile = { schemaVersion?: unknown; crosswalks?: unknown };

const validSide = (side: unknown): side is CrosswalkSideAdapter =>
	typeof side === "object" &&
	side !== null &&
	["geography", "boundaryRelease", "codeProperty", "nameProperty"].every(
		(key) => typeof (side as Record<string, unknown>)[key] === "string",
	) &&
	((side as { aliasProperty?: unknown }).aliasProperty === undefined ||
		typeof (side as { aliasProperty?: unknown }).aliasProperty ===
			"string");

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
			!validSide((adapter as CrosswalkAdapter).from) ||
			!validSide((adapter as CrosswalkAdapter).to)
		) {
			throw new Error(`Invalid crosswalk adapter at ${path}`);
		}
		return adapter as CrosswalkAdapter;
	});
};
