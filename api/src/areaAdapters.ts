import { readFileSync } from "node:fs";

export type AreaPropertyAdapter = {
	codeProperty: string;
	nameProperty: string;
};

export type AreaAdapterManifest = Record<string, AreaPropertyAdapter>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isAreaPropertyAdapter = (value: unknown): value is AreaPropertyAdapter =>
	isRecord(value) &&
	typeof value.codeProperty === "string" &&
	typeof value.nameProperty === "string";

export const readAreaAdapters = (path: string): AreaAdapterManifest => {
	const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
	if (
		!isRecord(parsed) ||
		parsed.schemaVersion !== 1 ||
		!isRecord(parsed.releases)
	) {
		throw new Error(`Invalid area adapter manifest at ${path}`);
	}
	return Object.fromEntries(
		Object.entries(parsed.releases).map(([identity, adapter]) => {
			if (!isAreaPropertyAdapter(adapter)) {
				throw new Error(
					`Invalid area adapter for ${identity} at ${path}`,
				);
			}
			return [identity, adapter];
		}),
	);
};
