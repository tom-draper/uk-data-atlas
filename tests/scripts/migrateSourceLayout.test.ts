import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, onTestFinished, test } from "vitest";
import { SOURCES, sourceDir } from "@uk-data-atlas/datasets";
import {
	migrateMarker,
	migrateSourceLayout,
	movedPath,
	SOURCE_MOVES,
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

test("every SOURCES folder is the target of one move, the rest go to _staging", () => {
	const targets = SOURCE_MOVES.map(([, to]) => to);
	expect(new Set(targets).size).toBe(targets.length);
	for (const name of Object.keys(SOURCES))
		expect(targets, name).toContain(
			sourceDir(name as keyof typeof SOURCES),
		);
	const staged = SOURCE_MOVES.filter(([, to]) => to.startsWith("_staging/"));
	expect(staged.length).toBe(14);
	expect(targets.length).toBe(Object.keys(SOURCES).length + staged.length);
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
		expect(movedPath(`${from}/file.csv`), from).toBe(`${to}/file.csv`);
		expect(movedPath(`${to}/file.csv`), to).toBeNull();
	}
});
