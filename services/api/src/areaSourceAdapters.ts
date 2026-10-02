import { readFileSync } from "node:fs";

export type AreaSourceAdapter = {
	source: {
		geography: string;
		boundaryRelease: string;
	};
	filter: {
		property: string;
		startsWith: string;
	};
};

export type AreaSourceAdapterManifest = Record<string, AreaSourceAdapter>;

type AdapterFile = { schemaVersion?: unknown; releases?: unknown };

export const readAreaSourceAdapters = (
	path: string,
): AreaSourceAdapterManifest => {
	const file = JSON.parse(readFileSync(path, "utf8")) as AdapterFile;
	if (
		file.schemaVersion !== 1 ||
		typeof file.releases !== "object" ||
		file.releases === null
	) {
		throw new Error(`Invalid area source adapter manifest at ${path}`);
	}
	return Object.fromEntries(
		Object.entries(file.releases).map(([identity, adapter]) => {
			const source = (adapter as AreaSourceAdapter | undefined)?.source;
			const filter = (adapter as AreaSourceAdapter | undefined)?.filter;
			if (
				typeof source?.geography !== "string" ||
				typeof source.boundaryRelease !== "string" ||
				typeof filter?.property !== "string" ||
				typeof filter.startsWith !== "string"
			) {
				throw new Error(
					`Invalid area source adapter for ${identity} at ${path}`,
				);
			}
			return [identity, adapter as AreaSourceAdapter];
		}),
	);
};
