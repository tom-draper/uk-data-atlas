/**
 * Fetch the atlas's containment and lineage lookups from the API into
 * .cache/atlas-lookups, for the precompile to read. A file is only rewritten
 * when its contents change, so an unchanged lookup does not look new to
 * `precompile:if-needed`. Offline, a complete cached copy is kept.
 *
 * Set NEXT_PUBLIC_ATLAS_API_ORIGIN to read a local API, the same one the
 * browser then reads.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { atlasLookupUrl } from "../lib/helpers/atlasApi";
import { ATLAS_LOOKUP_NAMES, atlasLookupPath } from "./atlas-lookups";

const root = join(import.meta.dirname, "..");

const cached = async (path: string) => {
	try {
		return await readFile(path);
	} catch {
		return undefined;
	}
};

const results = await Promise.allSettled(
	ATLAS_LOOKUP_NAMES.map(async (name) => {
		const url = atlasLookupUrl(name.slice(0, -".json".length));
		const path = atlasLookupPath(root, name);
		const response = await fetch(url);
		if (!response.ok) throw new Error(`${url} answered ${response.status}`);
		const body = Buffer.from(await response.arrayBuffer());
		JSON.parse(body.toString("utf8"));
		if ((await cached(path))?.equals(body)) return false;
		await mkdir(dirname(path), { recursive: true });
		await writeFile(`${path}.tmp`, body);
		await rename(`${path}.tmp`, path);
		return true;
	}),
);

const failed = results.flatMap((result, index) =>
	result.status === "rejected"
		? [{ name: ATLAS_LOOKUP_NAMES[index]!, reason: result.reason }]
		: [],
);
const missing = (
	await Promise.all(
		failed.map(async ({ name }) =>
			(await cached(atlasLookupPath(root, name))) ? [] : [name],
		),
	)
).flat();
for (const { name, reason } of failed)
	console.warn(`  Could not fetch ${name}: ${String(reason)}`);
if (missing.length > 0) {
	console.error(
		`No copy of ${missing.join(", ")}. Start the API, or set NEXT_PUBLIC_ATLAS_API_ORIGIN to one serving them.`,
	);
	process.exit(1);
}
const updated = results.filter(
	(result) => result.status === "fulfilled" && result.value,
).length;
console.log(
	failed.length > 0
		? `Kept the cached copy of ${failed.length} atlas lookups.`
		: `Atlas lookups: ${updated} updated, ${ATLAS_LOOKUP_NAMES.length - updated} unchanged.`,
);
