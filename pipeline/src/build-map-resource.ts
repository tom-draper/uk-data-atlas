import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMapResources } from "./buildMapResource";

const path = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === path) {
	const result = buildMapResources(resolve(dirname(path), "../.."), (line) =>
		console.log(line),
	);
	console.log(
		`Wrote ${result.resources.length} map resources to ${result.path}` +
			(result.unavailable.length
				? `; ${result.unavailable.length} releases could not be tiled`
				: ""),
	);
}
