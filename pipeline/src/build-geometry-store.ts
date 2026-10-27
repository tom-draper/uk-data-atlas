import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildGeometryStore } from "../../shared/buildGeometryStore";

const path = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === path) {
	const result = buildGeometryStore(resolve(dirname(path), "../.."), (line) =>
		console.log(line),
	);
	console.log(
		`Geometry store holds ${result.releases} releases in ${result.directory}; ${result.compiled} compiled.`,
	);
}
