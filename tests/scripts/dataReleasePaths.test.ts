import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { expect, onTestFinished, test } from "vitest";
import { filesUnder, replaceSources } from "@/scripts/data-release.mjs";

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

test("downloads may finish out of order and only verified archives are reused", () => {
	const root = mkdtempSync(join(tmpdir(), "atlas-release-cache-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	for (const script of [
		"scripts/data-release.mjs",
		"scripts/migrate-source-layout.mjs",
		"scripts/migrate-source-meta.mjs",
		"packages/atlas-db/src/buildTiming.ts",
	]) {
		mkdirSync(join(root, dirname(script)), { recursive: true });
		copyFileSync(script, join(root, script));
	}
	const incoming = join(root, "publisher");
	const bin = join(root, "bin");
	const cache = join(root, "archives");
	const calls = join(root, "calls.log");
	mkdirSync(incoming);
	mkdirSync(bin);
	const assets = ["first", "second"].map((content, index) => {
		writeFileSync(join(incoming, "source.csv"), content);
		const name = `part-${index}.tar.gz`;
		execFileSync("tar", [
			"--create",
			"--gzip",
			"--file",
			join(incoming, name),
			"--directory",
			incoming,
			"source.csv",
		]);
		const bytes = readFileSync(join(incoming, name));
		return {
			name,
			bytes: bytes.length,
			sha256: createHash("sha256").update(bytes).digest("hex"),
		};
	});
	writeFileSync(
		join(root, "data-release.json"),
		JSON.stringify({
			version: 2,
			tag: "data-2026-10-30",
			commit: "a".repeat(40),
			repository: "fixture/release",
			assets,
		}),
	);
	writeFileSync(
		join(bin, "curl"),
		`#!/bin/sh
while [ "$1" != "--output" ]; do shift; done
name=$(basename "$3")
if [ "$name" = part-0.tar.gz ]; then sleep 0.3; fi
cp "$FIXTURE_ARCHIVES/$name" "$2" || exit 1
echo "$name" >> "$FIXTURE_CALLS"
`,
		{ mode: 0o755 },
	);
	const download = (option: string) =>
		execFileSync(
			process.execPath,
			["scripts/data-release.mjs", "download", option],
			{
				cwd: root,
				env: {
					...process.env,
					PATH: [bin, process.env.PATH].join(delimiter),
					DATA_DOWNLOAD_JOBS: "2",
					DATA_SOURCE_ARCHIVE_CACHE_DIR: cache,
					FIXTURE_ARCHIVES: incoming,
					FIXTURE_CALLS: calls,
				},
				stdio: "pipe",
			},
		);
	const requests = () => readFileSync(calls, "utf8").trim().split("\n");
	const source = join(root, "data/source/source.csv");

	download("--replace");
	expect(requests()).toEqual([assets[1]!.name, assets[0]!.name]);
	expect(readFileSync(source, "utf8")).toBe("second");

	download("--replace");
	expect(requests()).toHaveLength(2);
	const second = assets[1]!;
	const cached = join(cache, `${second.sha256}.tar.gz`);
	const archive = readFileSync(cached);
	writeFileSync(cached, Buffer.alloc(archive.length));
	download("--replace");
	expect(requests().slice(2)).toEqual([second.name]);
	expect(readFileSync(cached)).toEqual(archive);

	writeFileSync(join(incoming, second.name), Buffer.alloc(archive.length));
	expect(() => download("--force")).toThrow(/Checksum verification failed/);
	expect(readFileSync(cached)).toEqual(archive);
	expect(readFileSync(source, "utf8")).toBe("second");
});
