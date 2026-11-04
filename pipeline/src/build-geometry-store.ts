import {
	buildLog,
	formatCount,
	repoPath,
} from "@uk-data-atlas/atlas-runtime/storage";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildGeometryStore } from "./maps/buildGeometryStore.ts";

const path = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === path) {
	const result = buildGeometryStore(resolve(dirname(path), "../.."), (line) =>
		buildLog.detail(line),
	);
	buildLog.info(
		`Geometry store holds ${formatCount(result.releases)} releases in ${repoPath(result.directory)}, ${formatCount(result.compiled)} compiled`,
	);
}
