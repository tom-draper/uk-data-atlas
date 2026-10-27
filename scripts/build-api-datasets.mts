export { buildDatasets } from "../pipeline/src/build-api-datasets.mts";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDatasets } from "../pipeline/src/build-api-datasets.mts";

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const result = await buildDatasets(resolve(import.meta.dirname, ".."));
	console.log(
		`Wrote boundary assets and gazetteer core to ${result.directory}`,
	);
}
