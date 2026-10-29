import { execFileSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { expect, onTestFinished, test } from "vitest";
import {
	filesUnder,
	replaceSources,
	validateReleaseDatabases,
} from "@/scripts/data-release.mjs";

test("release databases must refer to the same canonical file", async () => {
	const build = mkdtempSync(join(tmpdir(), "atlas-release-databases-"));
	onTestFinished(() => rmSync(build, { recursive: true, force: true }));
	writeFileSync(join(build, "atlas.sqlite"), "canonical");
	const database = new DatabaseSync(join(build, "atlas-cache.sqlite"));
	database.exec(
		"CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
	);
	database
		.prepare("INSERT INTO meta VALUES (?, ?)")
		.run(
			"atlas-sqlite-content-hash",
			`sha256:${createHash("sha256").update("canonical").digest("hex")}`,
		);
	database.close();
	await expect(validateReleaseDatabases(build)).resolves.toBeUndefined();
	writeFileSync(join(build, "atlas.sqlite"), "different");
	await expect(validateReleaseDatabases(build)).rejects.toThrow(
		"Cache release mismatch",
	);
});

test("restoring raw sources preserves generated data and excludes it from releases", async () => {
	const root = mkdtempSync(join(tmpdir(), "atlas-release-paths-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	const data = join(root, "data/source");
	const build = join(root, "data/build");
	const staging = join(root, "incoming");
	const workspace = join(root, "workspace");
	for (const directory of [data, build, staging, workspace])
		mkdirSync(directory, { recursive: true });
	writeFileSync(join(data, "old.csv"), "old");
	writeFileSync(join(build, "atlas.sqlite"), "generated database");
	writeFileSync(join(staging, "new.csv"), "new");
	await replaceSources(staging, { data, workspace });
	expect(readFileSync(join(build, "atlas.sqlite"), "utf8")).toBe(
		"generated database",
	);
	expect(await filesUnder(data)).toEqual([{ path: "new.csv", bytes: 3 }]);
	expect(readFileSync(join(data, "new.csv"), "utf8")).toBe("new");
});

test("an archive with existing release paths restores into a fresh source directory", async () => {
	const root = mkdtempSync(join(tmpdir(), "atlas-release-archive-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	const incoming = join(root, "publisher");
	const extracted = join(root, "extracted");
	const workspace = join(root, "workspace");
	for (const directory of [
		join(incoming, "boundaries/ward"),
		extracted,
		workspace,
	])
		mkdirSync(directory, { recursive: true });
	writeFileSync(
		join(incoming, "boundaries/ward/source.geojson"),
		'{"type":"FeatureCollection","features":[]}',
	);
	const archive = join(root, "release.tar.gz");
	execFileSync("tar", [
		"--create",
		"--gzip",
		"--file",
		archive,
		"--directory",
		incoming,
		"boundaries",
	]);
	execFileSync("tar", [
		"--extract",
		"--gzip",
		"--file",
		archive,
		"--directory",
		extracted,
	]);
	const data = join(root, "fresh/data/source");
	await replaceSources(extracted, { data, workspace });
	expect(
		readFileSync(join(data, "boundaries/ward/source.geojson"), "utf8"),
	).toBe('{"type":"FeatureCollection","features":[]}');
	expect(await filesUnder(data)).toEqual([
		{ path: "boundaries/ward/source.geojson", bytes: 42 },
	]);
});
