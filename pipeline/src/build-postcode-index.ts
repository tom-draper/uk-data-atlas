import { isMainModule } from "./lib/entrypoint.ts";
import { buildLog, formatCount, repoPath } from "@uk-data-atlas/atlas-db";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPostcodeIndex } from "./postcodes/buildPostcodeIndex.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const { outputPath, artifact } = await buildPostcodeIndex(
		resolve(dirname(scriptPath), "../.."),
	);
	buildLog.info(
		`Wrote ${formatCount(artifact.counts.postcodes)} postcodes (${formatCount(artifact.counts.live)} live) in ${formatCount(artifact.shards.length)} districts to ${repoPath(outputPath)}${artifact.excluded.length ? `, leaving out ${artifact.excluded.map((entry) => `${entry.area} (${entry.postcodes})`).join(", ")}` : ""}`,
	);
}
