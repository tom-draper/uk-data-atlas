/**
 * Copy the lookups and pages the API build compiles for the website from its
 * output on disk, services/api/public, into public/data. The website serves
 * and reads its own copy, so neither building nor running it needs a running
 * API. A file is only rewritten when its contents change, so an unchanged
 * lookup does not look new to the dev data check. Without an API build,
 * a complete earlier copy is kept.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
	mkdir,
	readdir,
	readFile,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { ATLAS_LOOKUPS_PATH, ATLAS_PAGES_PATH } from "../lib/helpers/atlasData";
import { ATLAS_LOOKUP_NAMES } from "./atlas-lookups";

const root = join(import.meta.dirname, "..");
const apiPublic = join(root, "services", "api", "public");

type Manifest = {
	schemaVersion: 1;
	[list: string]: unknown;
};
type Entry = { id: string; artifact: string; contentHash: string };

const isEntry = (value: unknown): value is Entry =>
	typeof value === "object" &&
	value !== null &&
	typeof (value as Entry).id === "string" &&
	/^[A-Za-z0-9-]+$/.test((value as Entry).id) &&
	typeof (value as Entry).artifact === "string" &&
	typeof (value as Entry).contentHash === "string";

const cached = (path: string) => readFile(path).catch(() => undefined);

/** Mirror one API output list into `destination`, returning the files changed. */
async function copy(
	manifestName: string,
	list: "lookups" | "pages",
	destination: string,
	required: readonly string[],
): Promise<number | undefined> {
	const manifestPath = join(apiPublic, manifestName);
	if (!existsSync(manifestPath)) return undefined;
	const manifest = JSON.parse(
		await readFile(manifestPath, "utf8"),
	) as Manifest;
	const entries = manifest[list];
	if (
		manifest.schemaVersion !== 1 ||
		!Array.isArray(entries) ||
		!entries.every(isEntry)
	)
		throw new Error(`${manifestPath} is not schema version 1.`);
	const ids = new Set(entries.map(({ id }) => id));
	const absent = required.filter((id) => !ids.has(id));
	if (absent.length > 0)
		throw new Error(
			`The API build has no ${absent.join(", ")}. Rebuild it with pnpm data:build --from atlas-${list}.`,
		);

	await mkdir(destination, { recursive: true });
	let changed = 0;
	for (const { id, artifact, contentHash } of entries) {
		const json = gunzipSync(await readFile(join(apiPublic, artifact)));
		const hash = `sha256:${createHash("sha256").update(json).digest("hex")}`;
		if (hash !== contentHash)
			throw new Error(`${artifact} does not match its manifest hash.`);
		const path = join(destination, `${id}.json`);
		if ((await cached(path))?.equals(json)) continue;
		await writeFile(`${path}.tmp`, json);
		await rename(`${path}.tmp`, path);
		changed++;
	}
	for (const name of await readdir(destination))
		if (!ids.has(name.replace(/\.json$/, ""))) {
			await rm(join(destination, name), { force: true });
			changed++;
		}
	return changed;
}

/** Whether an earlier copy holds every required file. */
const complete = async (destination: string, required: readonly string[]) =>
	(
		await Promise.all(
			required.map(async (id) =>
				Boolean(await cached(join(destination, `${id}.json`))),
			),
		)
	).every(Boolean);

const outputs = [
	{
		manifest: "atlas-lookups.json",
		list: "lookups",
		destination: join(root, "public", ATLAS_LOOKUPS_PATH),
		required: ATLAS_LOOKUP_NAMES.map((name) => name.replace(/\.json$/, "")),
	},
	{
		manifest: "atlas-pages.json",
		list: "pages",
		destination: join(root, "public", ATLAS_PAGES_PATH),
		required: [
			"docs-catalogue",
			"place-facts",
			"places-index",
			"ward-areas",
		],
	},
] as const;

let failed = false;
for (const { manifest, list, destination, required } of outputs) {
	const changed = await copy(manifest, list, destination, required);
	if (changed !== undefined) {
		console.log(`Atlas ${list}: ${changed} files changed.`);
	} else if (await complete(destination, required)) {
		console.warn(
			`No API build of the atlas ${list}; keeping the earlier copy.`,
		);
	} else {
		console.error(
			`No atlas ${list} in services/api/public. Build the API data first: pnpm data:build`,
		);
		failed = true;
	}
}
if (failed) process.exit(1);
