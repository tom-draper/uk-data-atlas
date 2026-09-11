import { readFileSync } from "node:fs";

export type AreaPropertyAdapter = {
	codeProperty: string;
	nameProperty: string;
};

export type AreaAdapterManifest = Record<string, AreaPropertyAdapter>;

type AdapterFile = { schemaVersion?: unknown; releases?: unknown };

export const readAreaAdapters = (path: string): AreaAdapterManifest => {
	const file = JSON.parse(readFileSync(path, "utf8")) as AdapterFile;
	if (
		file.schemaVersion !== 1 ||
		typeof file.releases !== "object" ||
		file.releases === null
	) {
		throw new Error(`Invalid area adapter manifest at ${path}`);
	}
	return Object.fromEntries(
		Object.entries(file.releases).map(([identity, adapter]) => {
			if (
				typeof adapter !== "object" ||
				adapter === null ||
				typeof (adapter as AreaPropertyAdapter).codeProperty !==
					"string" ||
				typeof (adapter as AreaPropertyAdapter).nameProperty !==
					"string"
			) {
				throw new Error(
					`Invalid area adapter for ${identity} at ${path}`,
				);
			}
			return [identity, adapter as AreaPropertyAdapter];
		}),
	);
};
