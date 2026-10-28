import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	readAtlasCatalogues,
	type CatalogueOptions,
} from "../catalogue/catalogueLoader";
import { createOperationMatcher } from "./operationTemplates";
import { readOperations } from "./operationsLoader";

export const readApiCatalogues = (
	apiRoot: string,
	options: CatalogueOptions = {},
) => {
	const catalogues = readAtlasCatalogues(apiRoot, options);
	const stage = <T>(name: string, read: () => T): T => {
		if (!options.onStage) return read();
		const started = performance.now();
		const value = read();
		options.onStage(name, performance.now() - started);
		return value;
	};
	const openapiDocument = stage("openapi-document", () =>
		readFileSync(resolve(apiRoot, "openapi.yaml"), "utf8"),
	);
	const operationMatcher = stage("openapi-operation-matcher", () =>
		createOperationMatcher(
			readOperations(apiRoot, openapiDocument).operations,
		),
	);
	return { ...catalogues, openapiDocument, operationMatcher };
};

export type ApiCatalogues = ReturnType<typeof readApiCatalogues>;
