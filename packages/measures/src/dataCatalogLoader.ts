import { readFileSync } from "node:fs";
import { publicPath } from "@uk-data-atlas/atlas-db";
import type { DataCatalog } from "./dataCatalog.ts";
import { withUnitDefinitions } from "./catalogueUnits.ts";

export const readDataCatalog = (repositoryRoot: string): DataCatalog => {
	const path = publicPath(repositoryRoot, "data-catalog.json");
	const catalog = JSON.parse(readFileSync(path, "utf8")) as DataCatalog;
	if (
		catalog.schemaVersion !== 1 ||
		!Array.isArray(catalog.datasets) ||
		!Array.isArray(catalog.measures)
	) {
		throw new Error(`Invalid data catalogue at ${path}`);
	}
	return withUnitDefinitions(catalog);
};
