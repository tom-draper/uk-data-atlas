import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	readAtlasCatalogues,
	type CatalogueOptions,
} from "../catalogue/catalogueLoader";
import { createOperationMatcher } from "./operationTemplates";
import { readOperations } from "./operationsLoader";
import { apiRootOf } from "../storage/dataLayout";

export const readApiCatalogues = (
	repositoryRoot: string,
	options: CatalogueOptions = {},
) => {
	const catalogues = readAtlasCatalogues(repositoryRoot, options);
	const stage = <T>(name: string, read: () => T): T => {
		if (!options.onStage) return read();
		const started = performance.now();
		const value = read();
		options.onStage(name, performance.now() - started);
		return value;
	};
	const openapiDocument = stage("openapi-document", () =>
		readFileSync(
			resolve(apiRootOf(repositoryRoot), "openapi.yaml"),
			"utf8",
		),
	);
	const operationMatcher = stage("openapi-operation-matcher", () =>
		createOperationMatcher(
			readOperations(repositoryRoot, openapiDocument).operations,
		),
	);
	return { ...catalogues, openapiDocument, operationMatcher };
};

export type ApiCatalogues = ReturnType<typeof readApiCatalogues>;
