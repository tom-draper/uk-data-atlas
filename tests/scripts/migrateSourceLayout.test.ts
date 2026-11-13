import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, onTestFinished, test } from "vitest";
import { SOURCES, sourceDir } from "@uk-data-atlas/datasets";
import {
	migrateMarker,
	migrateSourceLayout,
	movedPath,
	SOURCE_MOVES,
	SOURCE_RENAMES,
} from "@/scripts/migrate-source-layout.mjs";

const write = (root: string, path: string, text = path) => {
	mkdirSync(dirname(join(root, path)), { recursive: true });
	writeFileSync(join(root, path), text);
};

const tree = () => {
	const root = mkdtempSync(join(tmpdir(), "source-layout-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	return root;
};

test("every SOURCES folder is the final path of one move, the rest go to _staging", () => {
	const final = (to: string) =>
		SOURCE_RENAMES.find(([from]) => from === to)?.[1] ?? to;
	const targets = SOURCE_MOVES.map(([, to]) => final(to));
	expect(new Set(targets).size).toBe(targets.length);
	for (const name of Object.keys(SOURCES))
		expect(targets, name).toContain(
			sourceDir(name as keyof typeof SOURCES),
		);
	const staged = SOURCE_MOVES.filter(([, to]) => to.startsWith("_staging/"));
	expect(staged.length).toBe(14);
	expect(targets.length).toBe(Object.keys(SOURCES).length + staged.length);
});

test("every rename starts at a folder of the theme layout", () => {
	const themed = SOURCE_MOVES.map(([, to]) => to);
	for (const [from] of SOURCE_RENAMES) expect(themed, from).toContain(from);
});

test("moves nested folders and ones whose new path is inside the old", async () => {
	const root = tree();
	write(root, "economics/local-government-finance/meta.json", "parent");
	write(
		root,
		"economics/local-government-finance/council-tax/meta.json",
		"child",
	);
	write(root, "health/life-expectancy/meta.json", "life");
	write(root, "health/gp-appointments/meta.json", "unused");
	write(root, "lookups/ward-history/meta.json", "lookup");
	write(root, "boundaries/ward/meta.json", "boundary");
	write(root, "economics/NOTES.txt", "stray");

	const first = await migrateSourceLayout(root);
	expect(first.conflicts).toEqual([]);
	expect(first.strays).toEqual(["economics/NOTES.txt"]);
	const read = (path: string) => readFileSync(join(root, path), "utf8");
	expect(read("housing/housing-stock/council-tax/meta.json")).toBe("child");
	expect(
		read("economy/public-finance/local-government-finance/meta.json"),
	).toBe("parent");
	expect(read("health/life-expectancy/life-expectancy/meta.json")).toBe(
		"life",
	);
	expect(read("_staging/gp-appointments/meta.json")).toBe("unused");
	expect(read("core/lookups/ward-history/meta.json")).toBe("lookup");
	expect(read("boundaries/ward/meta.json")).toBe("boundary");
	expect(existsSync(join(root, "lookups"))).toBe(false);
	expect(existsSync(join(root, "health/gp-appointments"))).toBe(false);
	expect(existsSync(join(root, ".layout-move"))).toBe(false);

	// Run again: nothing is left to move.
	expect(await migrateSourceLayout(root)).toEqual({
		moved: [],
		conflicts: [],
		strays: [],
		rewrites: [],
	});
});

test("refuses to move when a new path is already taken", async () => {
	const root = tree();
	write(root, "lookups/meta.json");
	write(root, "core/lookups/meta.json");
	const result = await migrateSourceLayout(root);
	expect(result.conflicts).toEqual(["core/lookups"]);
	expect(existsSync(join(root, "lookups/meta.json"))).toBe(true);
});

test("rewrites the release marker and keeps hashes and edited stamps", async () => {
	const root = tree();
	write(root, "lookups/ward-history/a.csv", "aaa");
	write(root, "boundaries/ward/b.csv", "bbb");
	const stamp = (path: string) => {
		const s = statSync(join(root, path));
		return { bytes: s.size, modifiedAt: s.mtimeMs, changedAt: s.ctimeMs };
	};
	const edited = { ...stamp("lookups/ward-history/a.csv"), bytes: 1 };
	writeFileSync(
		join(root, ".source-release.json"),
		JSON.stringify({
			version: 3,
			tag: "data-x",
			files: {
				"lookups/ward-history/a.csv": "h1",
				"boundaries/ward/b.csv": "h2",
			},
			fileStamps: {
				"lookups/ward-history/a.csv": edited,
				"boundaries/ward/b.csv": stamp("boundaries/ward/b.csv"),
			},
		}),
	);
	await migrateSourceLayout(root);
	expect(await migrateMarker(root)).toBe(2);
	const marker = JSON.parse(
		readFileSync(join(root, ".source-release.json"), "utf8"),
	);
	expect(marker.files).toEqual({
		"core/lookups/ward-history/a.csv": "h1",
		"boundaries/ward/b.csv": "h2",
	});
	expect(marker.fileStamps["core/lookups/ward-history/a.csv"]).toEqual(
		edited,
	);
	expect(await migrateMarker(root)).toBe(0);
});

test("movedPath maps a file in an old folder and leaves others alone", () => {
	expect(movedPath("lookups/x/y.csv")).toBe("core/lookups/x/y.csv");
	expect(movedPath("boundaries/x/y.csv")).toBeNull();
});

test("a path already in a folder nested in its old one is not moved again", () => {
	for (const [from, to] of SOURCE_MOVES.filter(([from, to]) =>
		to.startsWith(`${from}/`),
	)) {
		expect(movedPath(`${from}/file.csv`, []), from).toBe(`${to}/file.csv`);
		expect(movedPath(`${to}/file.csv`, []), to).toBeNull();
	}
});

const RENAMES: [string, string][] = [
	[
		"transport/road-safety/road-safety",
		"transport/road-safety/road-collisions",
	],
	["health/health-status/ts037", "health/health-status/census-2021-ts037"],
];

test("renames reach the final path from the old layout or the theme layout", async () => {
	const old = tree();
	write(old, "transport/road-safety/a.csv", "old");
	write(old, "demographics/census-2021-small-area/ts037/meta.json", "old");
	const themed = tree();
	write(themed, "transport/road-safety/road-safety/a.csv", "themed");
	write(themed, "health/health-status/ts037/meta.json", "themed");
	for (const [root, text] of [
		[old, "old"],
		[themed, "themed"],
	] as const) {
		const result = await migrateSourceLayout(root, { renames: RENAMES });
		expect(result.conflicts).toEqual([]);
		const read = (path: string) => readFileSync(join(root, path), "utf8");
		expect(read("transport/road-safety/road-collisions/a.csv")).toBe(text);
		expect(read("health/health-status/census-2021-ts037/meta.json")).toBe(
			text,
		);
		expect(
			existsSync(join(root, "transport/road-safety/road-safety")),
		).toBe(false);
	}
});

test("a tree already in the final layout is left alone", async () => {
	const root = tree();
	write(root, "transport/road-safety/road-collisions/a.csv");
	write(root, "health/health-status/census-2021-ts037/meta.json");
	expect(await migrateSourceLayout(root, { renames: RENAMES })).toEqual({
		moved: [],
		conflicts: [],
		strays: [],
		rewrites: [],
	});
	expect(
		existsSync(join(root, "transport/road-safety/road-collisions/a.csv")),
	).toBe(true);
});

test("a dry run names the final path and moves nothing", async () => {
	const root = tree();
	write(root, "transport/road-safety/a.csv");
	write(root, "health/health-status/ts037/meta.json");
	const result = await migrateSourceLayout(root, {
		dryRun: true,
		renames: RENAMES,
	});
	expect(result.moved).toEqual(
		expect.arrayContaining([
			["transport/road-safety", "transport/road-safety/road-collisions"],
			[
				"health/health-status/ts037",
				"health/health-status/census-2021-ts037",
			],
		]),
	);
	expect(existsSync(join(root, "transport/road-safety/a.csv"))).toBe(true);
	expect(existsSync(join(root, "health/health-status/ts037"))).toBe(true);
});

test("movedPath sends a file in any earlier layout to the final path", () => {
	const opts = RENAMES;
	const final = "transport/road-safety/road-collisions/a.csv";
	expect(movedPath("transport/road-safety/a.csv", opts)).toBe(final);
	expect(movedPath("transport/road-safety/road-safety/a.csv", opts)).toBe(
		final,
	);
	expect(movedPath(final, opts)).toBeNull();
	expect(movedPath("health/ts037/a.csv", opts)).toBeNull();
	expect(
		movedPath("demographics/census-2021-small-area/ts037/a.csv", opts),
	).toBe("health/health-status/census-2021-ts037/a.csv");
});

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const META = '{\n\t"id": "ts037",\n\t"name": "Health \\"status\\""\n}\n';

test("a renamed folder gets its name as the id in meta.json, nothing else changed", async () => {
	const root = tree();
	write(root, "health/health-status/ts037/meta.json", META);
	const path = "health/health-status/census-2021-ts037/meta.json";
	const result = await migrateSourceLayout(root, { renames: RENAMES });
	expect(result.rewrites).toEqual([
		{
			path,
			before: sha(META),
			after: sha(META.replace('"ts037"', '"census-2021-ts037"')),
		},
	]);
	expect(readFileSync(join(root, path), "utf8")).toBe(
		META.replace('"ts037"', '"census-2021-ts037"'),
	);
	// Run again: the id is right, so there is nothing to set.
	expect(
		(await migrateSourceLayout(root, { renames: RENAMES })).rewrites,
	).toEqual([]);
});

test("a dry run reports no id rewrite and changes no file", async () => {
	const root = tree();
	write(root, "health/health-status/census-2021-ts037/meta.json", META);
	const result = await migrateSourceLayout(root, {
		dryRun: true,
		renames: RENAMES,
	});
	expect(result.rewrites).toHaveLength(1);
	expect(
		readFileSync(
			join(root, "health/health-status/census-2021-ts037/meta.json"),
			"utf8",
		),
	).toBe(META);
});

test("the marker takes the new hash of a rewritten meta.json unless it was edited", async () => {
	const root = tree();
	write(root, "health/health-status/ts037/meta.json", META);
	write(root, "transport/road-safety/road-safety/meta.json", '{"id":"x"}');
	const stamp = (path: string) => {
		const s = statSync(join(root, path));
		return { bytes: s.size, modifiedAt: s.mtimeMs, changedAt: s.ctimeMs };
	};
	const clean = "health/health-status/ts037/meta.json";
	const edited = "transport/road-safety/road-safety/meta.json";
	writeFileSync(
		join(root, ".source-release.json"),
		JSON.stringify({
			version: 3,
			tag: "data-x",
			files: { [clean]: sha(META), [edited]: "release-hash" },
			fileStamps: { [clean]: stamp(clean), [edited]: stamp(edited) },
		}),
	);
	const { rewrites } = await migrateSourceLayout(root, { renames: RENAMES });
	expect(rewrites).toHaveLength(2);
	await migrateMarker(root, { renames: RENAMES, rewrites });
	const marker = JSON.parse(
		readFileSync(join(root, ".source-release.json"), "utf8"),
	);
	const cleanNow = "health/health-status/census-2021-ts037/meta.json";
	const editedNow = "transport/road-safety/road-collisions/meta.json";
	const text = readFileSync(join(root, cleanNow), "utf8");
	expect(marker.files[cleanNow]).toBe(sha(text));
	expect(marker.fileStamps[cleanNow]).toEqual(stamp(cleanNow));
	// Edited by hand since the release: the recorded hash stays, so it still differs.
	expect(marker.files[editedNow]).toBe("release-hash");
});
