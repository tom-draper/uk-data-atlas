import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	readAtlasCatalogues,
	type CatalogueOptions,
} from "../loader/catalogueLoader.ts";
import { createOperationMatcher } from "./operationTemplates.ts";
import { readOperations } from "./operationsLoader.ts";
import { apiRootOf } from "@uk-data-atlas/atlas-db";

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
