import { readAtlasPayload } from "./atlasSqlite";
import { repositoryRootOf } from "./dataLayout";

export const readGeographyCatalogue = <T extends { schemaVersion: number }>(
	apiRoot: string,
	id: string,
	listKey: keyof T & string,
	label: string,
): T => {
	const catalogue: T = JSON.parse(
		readAtlasPayload(repositoryRootOf(apiRoot), id),
	);
	if (catalogue.schemaVersion !== 1 || !Array.isArray(catalogue[listKey]))
		throw new Error(`Invalid ${label} in atlas.sqlite:${id}`);
	return catalogue;
};
