import { isMainModule } from "./lib/entrypoint.ts";
import { parseOnlyArgument } from "./precompile/selection.ts";
import { compileCatalogueDatasets } from "./precompile/compileCatalogueDatasets.mts";

if (isMainModule(import.meta.url))
	await compileCatalogueDatasets(parseOnlyArgument(process.argv.slice(2)));
