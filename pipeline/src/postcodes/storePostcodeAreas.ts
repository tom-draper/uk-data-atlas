import { randomUUID } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { sha256 } from "@uk-data-atlas/artifacts";
import type { PostcodeAreasArtifact } from "@uk-data-atlas/geography/postcode-area-types";

export const postcodeAreasDirectory = (root: string) =>
	join(root, "data/build/postcode-areas-component");

export function readPostcodeAreaComponent(root: string, path: string) {
	return gunzipSync(
		readFileSync(join(postcodeAreasDirectory(root), `${path}.gz`)),
	).toString("utf8");
}

export function storePostcodeAreas(
	root: string,
	artifact: PostcodeAreasArtifact,
	readShard: (path: string) => string,
) {
	const directory = postcodeAreasDirectory(root);
	const temporary = mkdtempSync(join(root, "data/build/.postcode-areas-"));
	const backup = `${directory}.${randomUUID()}.backup`;
	try {
		for (const entry of artifact.shards) {
			const text = readShard(entry.path);
			if (sha256(text) !== entry.contentHash)
				throw new Error(`Invalid postcode area shard ${entry.path}`);
			const path = join(temporary, `${entry.path}.gz`);
			mkdirSync(dirname(path), { recursive: true });
			writeFileSync(path, gzipSync(text));
		}
		writeFileSync(
			join(temporary, "manifest.json"),
			JSON.stringify(artifact),
		);
		if (existsSync(directory)) renameSync(directory, backup);
		try {
			renameSync(temporary, directory);
		} catch (error) {
			if (existsSync(backup)) renameSync(backup, directory);
			throw error;
		}
		rmSync(backup, { recursive: true, force: true });
	} finally {
		rmSync(temporary, { recursive: true, force: true });
	}
	return join(directory, "manifest.json");
}
