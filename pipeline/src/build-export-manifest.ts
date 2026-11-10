import { isMainModule } from "./lib/entrypoint.ts";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildExportManifest } from "./atlas/buildExportManifest.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = await buildExportManifest(repositoryRoot);
	console.log(
		`Wrote ${result.exportCount} bulk exports to ${result.outputPath}`,
	);
}
