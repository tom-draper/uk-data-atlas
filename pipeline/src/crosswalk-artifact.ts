import { mkdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { CrosswalkArtifact } from "./crosswalkCompiler";
import { writeStoredText } from "../../shared/storedText";

/** Publish a complete checkpoint, preserving the previous file on failure. */
export const writeCrosswalkArtifact = (
	outputDirectory: string,
	artifact: CrosswalkArtifact,
) => {
	const directory = join(outputDirectory, "crosswalks");
	mkdirSync(directory, { recursive: true });
	const path = join(directory, `${artifact.id}.json`);
	const temporary = `${path}.${process.pid}.tmp`;
	try {
		writeStoredText(temporary, `${JSON.stringify(artifact, null, "\t")}\n`);
		renameSync(`${temporary}.gz`, `${path}.gz`);
		rmSync(path, { force: true });
	} finally {
		rmSync(`${temporary}.gz`, { force: true });
	}
	return path;
};
