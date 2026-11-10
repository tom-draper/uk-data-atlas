import { fileURLToPath } from "url";
import {
	readCatalogueDefinitions,
	readDatasetDeclarations,
	writeCatalogueRegistry,
} from "../catalog/buildCatalogueRegistry.ts";

if (process.argv[1] === fileURLToPath(import.meta.url))
	void Promise.all([
		readCatalogueDefinitions(),
		readDatasetDeclarations(),
	]).then(([definitions, declarations]) =>
		writeCatalogueRegistry(definitions, declarations),
	);
