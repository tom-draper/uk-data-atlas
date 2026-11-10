import { isMainModule } from "../lib/entrypoint.ts";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readAreaSourceAdapters } from "@uk-data-atlas/areas";
import {
	configDirectory,
	buildLog,
	formatCount,
} from "@uk-data-atlas/atlas-db";
import { buildDerivedBoundaries } from "../geographies/buildDerivedBoundaries.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const repositoryRoot = resolve(dirname(scriptPath), "../../..");
	const result = buildDerivedBoundaries(
		repositoryRoot,
		readAreaSourceAdapters(
			join(configDirectory(repositoryRoot), "area-source-adapters.json"),
		),
	);
	buildLog.info(
		`Wrote ${formatCount(result.releaseCount)} derived boundary releases`,
	);
}
