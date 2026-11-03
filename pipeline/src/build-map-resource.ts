import {
	buildLog,
	formatCount,
	repoPath,
} from "@uk-data-atlas/atlas-runtime/storage";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMapResources } from "./maps/buildMapResources";

const path = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === path) {
	const result = buildMapResources(resolve(dirname(path), "../.."), (line) =>
		buildLog.detail(line),
	);
	buildLog.info(
		`Wrote ${formatCount(result.resources.length)} map resources to ${repoPath(result.path)}` +
			(result.unavailable.length
				? `, ${formatCount(result.unavailable.length)} releases could not be tiled`
				: ""),
	);
}
