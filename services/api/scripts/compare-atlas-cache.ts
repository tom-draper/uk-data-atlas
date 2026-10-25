import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
const cacheTable = (name: string) =>
	/^(area_search_|place_index_|location_projection_)/.test(name) ||
	name === "postcode_counts";
const cachePayloads = new Set([
	"location-projection-inventory",
	"postcode-counts",
]);

/** Compare every stored value, including observation hashes and compressed projections. */
export function compareAtlasCache(beforePath: string, apiRoot: string) {
	const paths = [
		beforePath,
		resolve(apiRoot, "../../data/build/atlas.sqlite"),
		resolve(apiRoot, "../../data/build/atlas-cache.sqlite"),
	];
	const databases = paths.map(
		(path) => new DatabaseSync(path, { readOnly: true }),
	);
	const [before, canonical, cache] = databases;
	try {
		const tables = before
			.prepare(
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
			)
			.all()
			.map((row) => String(row.name));
		assert.ok(tables.length > 0, "No tables compared");
		const digest = (database: DatabaseSync, name: string) => {
			const columns = database
				.prepare(`PRAGMA table_info(${quote(name)})`)
				.all()
				.map((row) => quote(String(row.name)));
			const hash = createHash("sha256");
			let rows = 0;
			for (const row of database
				.prepare(
					`SELECT * FROM ${quote(name)} ORDER BY ${columns.join(", ")}`,
				)
				.iterate()) {
				rows++;
				hash.update(
					JSON.stringify(row, (_key, value) =>
						value instanceof Uint8Array
							? Buffer.from(value).toString("hex")
							: value,
					),
				);
				hash.update("\n");
			}
			return { rows, hash: hash.digest("hex") };
		};
		const comparisons = tables
			.filter((name) => name !== "payloads")
			.map((name) => {
				const destination = cacheTable(name) ? cache : canonical;
				if (cacheTable(name))
					assert.equal(
						canonical
							.prepare(
								"SELECT 1 FROM sqlite_master WHERE name = ?",
							)
							.get(name),
						undefined,
						`Cache table ${name} remains canonical`,
					);
				const old = digest(before, name);
				const next = digest(destination, name);
				return {
					name,
					rows: old.rows,
					matches: old.rows === next.rows && old.hash === next.hash,
				};
			});
		for (const row of before
			.prepare("SELECT id, payload FROM payloads ORDER BY id")
			.all()) {
			const id = String(row.id);
			const destination = cachePayloads.has(id) ? cache : canonical;
			const next = destination
				.prepare("SELECT payload FROM payloads WHERE id = ?")
				.get(id)?.payload;
			const matches =
				id === "location-projection-inventory"
					? typeof next === "string" &&
						JSON.stringify(JSON.parse(String(row.payload))) ===
							JSON.stringify(JSON.parse(next))
					: row.payload === next;
			comparisons.push({ name: `payload:${id}`, rows: 1, matches });
			if (cachePayloads.has(id))
				assert.equal(
					canonical
						.prepare("SELECT 1 FROM payloads WHERE id = ?")
						.get(id),
					undefined,
				);
		}
		const report = {
			mismatches: comparisons.filter((row) => !row.matches).length,
			comparisons,
			files: paths.map((path, index) => ({
				path,
				bytes: statSync(path).size,
				objects: databases[index]!.prepare(
					"SELECT name, sum(pgsize) AS bytes FROM dbstat GROUP BY name ORDER BY name",
				).all(),
			})),
		};
		assert.equal(
			report.mismatches,
			0,
			JSON.stringify(report.comparisons.filter((row) => !row.matches)),
		);
		return report;
	} finally {
		for (const database of databases) database.close();
	}
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === resolve(import.meta.filename)
) {
	const [before, apiRoot, output, beforeHttp, afterHttp] =
		process.argv.slice(2);
	assert.ok(
		before && apiRoot,
		"Usage: compare-atlas-cache.ts BEFORE.sqlite API_ROOT [OUTPUT.json]",
	);
	const report = compareAtlasCache(before, apiRoot);
	let http: { comparisons: number; mismatches: number } | undefined;
	if (beforeHttp || afterHttp) {
		assert.ok(beforeHttp && afterHttp, "Both HTTP profiles are required");
		type Result = {
			route: string;
			status: number;
			bytes: number;
			hash: string;
			etag: string | null;
		};
		const read = (path: string): Result[] =>
			JSON.parse(readFileSync(path, "utf8")).results;
		const old = read(beforeHttp);
		const next = read(afterHttp);
		assert.ok(old.length > 0, "No HTTP responses compared");
		assert.equal(old.length, next.length);
		const mismatches = old.filter((row, index) => {
			const result = next[index]!;
			return (
				row.route !== result.route ||
				row.status !== 200 ||
				result.status !== 200 ||
				row.bytes !== result.bytes ||
				row.hash !== result.hash ||
				row.etag !== result.etag
			);
		});
		http = { comparisons: old.length, mismatches: mismatches.length };
		assert.deepEqual(mismatches, [], "HTTP body or ETag mismatch");
	}
	const text = `${JSON.stringify({ ...report, http }, null, 2)}\n`;
	if (output) writeFileSync(output, text);
	else process.stdout.write(text);
}
