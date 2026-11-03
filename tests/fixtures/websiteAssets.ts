import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { ATLAS_LOOKUP_NAMES } from "@/scripts/atlas-lookups";
import { buildAtlasAssets as stageAtlasAssets } from "@/pipeline/src/build-atlas-assets";
import { assembleAtlas } from "@/pipeline/src/assemble-atlas";
import { writeEmptyPostcodeComponent } from "@/services/api/tests/atlasComponentFixtures";
import type { AtlasAssetKind } from "@uk-data-atlas/atlas-runtime/storage";

const buildAtlasAssets = (root: string) => {
	stageAtlasAssets(root);
	assembleAtlas(root);
};

export function websiteAssetsFixture(pages: Record<string, unknown> = {}) {
	const root = mkdtempSync(join(tmpdir(), "website-assets-"));
	mkdirSync(join(root, "data/build"), { recursive: true });
	const database = new DatabaseSync(
		join(root, "data/build/atlas-base.sqlite"),
	);
	database.exec(
		"CREATE TABLE payloads (id TEXT PRIMARY KEY, payload TEXT); INSERT INTO payloads VALUES ('fixture', 'preserved')",
	);
	database.close();
	writeEmptyPostcodeComponent(root);
	writeFileSync(join(root, "data/build/geography-payloads.json"), "[]");
	const write = (kind: AtlasAssetKind, values: Record<string, unknown>) => {
		const directory = join(root, "data/build/atlas-assets");
		mkdirSync(join(directory, `atlas-${kind}`), { recursive: true });
		const entries = Object.entries(values).map(([id, value]) => {
			const json = JSON.stringify(value);
			const gzip = gzipSync(json);
			const artifact = `atlas-${kind}/${id}.json.gz`;
			writeFileSync(join(directory, artifact), gzip);
			return {
				id,
				artifact,
				bytes: Buffer.byteLength(json),
				gzipBytes: gzip.length,
				contentHash: `sha256:${createHash("sha256").update(json).digest("hex")}`,
			};
		});
		writeFileSync(
			join(directory, `atlas-${kind}.json`),
			JSON.stringify({ schemaVersion: 1, [kind]: entries }),
		);
	};
	write(
		"lookups",
		Object.fromEntries(
			ATLAS_LOOKUP_NAMES.map((name) => [
				name.slice(0, -5),
				{ lookup: name },
			]),
		),
	);
	write("pages", {
		"docs-catalogue": {},
		"place-facts": {},
		"places-index": {},
		"ward-areas": {},
		...pages,
	});
	buildAtlasAssets(root);
	return { root, write };
}
