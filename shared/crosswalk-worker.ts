import { join } from "node:path";
import {
	createCrosswalkCompiler,
	type CrosswalkArtifact,
} from "./crosswalkCompiler";
import { readGeometrySourceLookup } from "./geometrySources";
import { readStoredText } from "./storedText";
import { sha256 } from "./contentHash";
import { readCompiledAreaLookup } from "./crosswalk-build-inputs";
import { writeCrosswalkArtifact } from "./crosswalk-artifact";
import type { CrosswalkWork, CrosswalkWorkerResult } from "./crosswalk-workers";
import { apiRootOf, artifactDirectory } from "./dataLayout";

const [root, outputDirectory] = process.argv.slice(2);
if (!root || !outputDirectory || !process.send)
	throw new Error(
		"Crosswalk worker requires a build root, output directory and IPC.",
	);
process.on("disconnect", () => process.exit(1));
const send = (message: CrosswalkWorkerResult) => process.send!(message);
const { areaLookup } = readCompiledAreaLookup(artifactDirectory(root));
const compile = createCrosswalkCompiler(
	root,
	areaLookup,
	readGeometrySourceLookup(apiRootOf(root)),
);
process.on("message", (work: CrosswalkWork) => {
	const started = performance.now();
	try {
		let pairs: CrosswalkArtifact | undefined;
		if (work.pairs) {
			pairs = JSON.parse(
				readStoredText(work.pairs.path),
			) as CrosswalkArtifact;
			const { contentHash, ...content } = pairs;
			if (
				work.adapter.method !== "population-overlap" ||
				pairs.id !== work.adapter.pairs ||
				contentHash !== work.pairs.contentHash ||
				contentHash !== sha256(JSON.stringify(content))
			)
				throw new Error(
					`${work.adapter.id}: invalid area-overlap dependency.`,
				);
		}
		const artifact = compile(work.adapter, pairs);
		writeCrosswalkArtifact(outputDirectory, artifact);
		send({
			type: "compiled",
			id: artifact.id,
			contentHash: artifact.contentHash,
			seconds: (performance.now() - started) / 1000,
		});
	} catch (error) {
		send({
			type: "failed",
			id: work.adapter.id,
			message: error instanceof Error ? error.message : String(error),
		});
	}
});
send({ type: "ready" });
