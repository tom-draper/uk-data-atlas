import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { registryProblems } from "../src/ids/checkRegistries.ts";
import { IdRegistries } from "../src/ids/idRegistries.ts";
import { IdRegistry, checkAppendOnly } from "../src/ids/idRegistry.ts";
import { loadRegistry, saveRegistry } from "../src/ids/idStore.ts";

const directories: string[] = [];
const temporary = () => {
	const directory = mkdtempSync(join(tmpdir(), "id-registry-"));
	directories.push(directory);
	return directory;
};
afterEach(() => {
	for (const directory of directories.splice(0))
		rmSync(directory, { recursive: true, force: true });
});

const load = (
	directory: string,
	options: { first?: number; fields: number; segmented?: boolean },
) =>
	loadRegistry(directory, "t", {
		first: 1,
		segmented: false,
		frozen: false,
		...options,
	});

describe("IdRegistry", () => {
	it("numbers keys in the order they are met, from its first id", () => {
		const registry = new IdRegistry("test", { first: 0, fields: 1 });
		expect(registry.assign("b")).toBe(0);
		expect(registry.assign("a")).toBe(1);
		expect(registry.assign("b")).toBe(0);
		expect(registry.size).toBe(2);
		expect(registry.id("c")).toBeUndefined();
	});

	it("keeps the id of every key that was there when it grows", () => {
		const directory = temporary();
		const first = load(directory, { fields: 3 });
		const keys = [
			["lad", "2023", "E1"],
			["lad", "2023", "E2"],
			["ward", "2023", "W1"],
			["lad", "2023", "E3"],
		];
		const ids = keys.map((key) => first.registry.assign(...key));
		saveRegistry(directory, first);
		const path = join(directory, "t.txt");
		const text = readFileSync(path, "utf8");
		expect(text).toContain(
			"@lad\t2023\nE1\nE2\n@ward\t2023\nW1\n@lad\t2023\nE3\n",
		);

		const second = load(directory, { fields: 3 });
		expect(keys.map((key) => second.registry.id(...key))).toEqual(ids);
		// A new key goes last whatever its code sorts to.
		expect(second.registry.assign("lad", "2023", "E0")).toBe(5);
		expect(second.registry.assign("ward", "2024", "W1")).toBe(6);
		saveRegistry(directory, second);
		const grown = readFileSync(path, "utf8");
		expect(checkAppendOnly(text, grown)).toBe(true);

		const { registry: third } = load(directory, { fields: 3 });
		expect(keys.map((key) => third.id(...key))).toEqual(ids);
		expect(third.id("lad", "2023", "E0")).toBe(5);
		expect(third.id("ward", "2024", "W1")).toBe(6);
		expect(third.keyOf(6)).toEqual(["ward", "2024", "W1"]);
		expect([...third.entries()].map((entry) => entry.id)).toEqual([
			1, 2, 3, 4, 5, 6,
		]);
	});

	it("saves twice without writing anything twice", () => {
		const directory = temporary();
		const loaded = load(directory, { fields: 2 });
		loaded.registry.assign("a", "1");
		saveRegistry(directory, loaded);
		loaded.registry.assign("a", "2");
		loaded.registry.assign("b", "1");
		saveRegistry(directory, loaded);
		saveRegistry(directory, loaded);
		expect([...load(directory, { fields: 2 }).registry.entries()]).toEqual([
			{ id: 1, key: ["a", "1"] },
			{ id: 2, key: ["a", "2"] },
			{ id: 3, key: ["b", "1"] },
		]);
	});

	it("refuses a key listed twice, which would give it two ids", () => {
		expect(
			() =>
				new IdRegistry("t", {
					first: 1,
					fields: 2,
					text: "@a\nx\ny\n@b\nx\n@a\nx\n",
				}),
		).toThrow(/lists a\/x twice/);
	});

	it("refuses a blank line, which would shift every later id", () => {
		expect(
			() =>
				new IdRegistry("t", { first: 1, fields: 1, text: "a\n\nb\n" }),
		).toThrow(/blank or malformed/);
	});

	it("refuses a key the file cannot hold", () => {
		const registry = new IdRegistry("t", { first: 1, fields: 1 });
		expect(() => registry.assign("a\tb")).toThrow(/tabs or line breaks/);
		expect(() => registry.assign("")).toThrow(/not empty/);
		expect(() => registry.assign("@a")).toThrow(/cannot start/);
		expect(() => registry.assign("=1")).toThrow(/cannot start/);
		expect(() => registry.assign("a", "b")).toThrow(/1 fields/);
	});

	it("refuses to assign in a frozen registry", () => {
		const registry = new IdRegistry("t", {
			first: 1,
			fields: 1,
			text: "a\n",
			frozen: true,
		});
		expect(registry.assign("a")).toBe(1);
		expect(() => registry.assign("b")).toThrow(/has no id for b/);
	});

	it("refuses to save over a file someone else changed", () => {
		const directory = temporary();
		const first = load(directory, { fields: 1 });
		first.registry.assign("a");
		saveRegistry(directory, first);
		const other = load(directory, { fields: 1 });
		const path = join(directory, "t.txt");
		writeFileSync(path, readFileSync(path, "utf8") + "z\n");
		other.registry.assign("b");
		expect(() => saveRegistry(directory, other)).toThrow(
			/changed while it was in use/,
		);
	});

	it("looks codes up in more prefixes than it keeps tables for", () => {
		const registry = new IdRegistry("t", { first: 1, fields: 2 });
		const ids = new Map<string, number>();
		for (let release = 0; release < 20; release++)
			for (const code of ["a", "b", "c"])
				ids.set(
					`${release}/${code}`,
					registry.assign(`r${release}`, code),
				);
		for (const [key, id] of ids) {
			const [release, code] = key.split("/");
			expect(registry.id(`r${release}`, code!)).toBe(id);
		}
	});
});

describe("a segmented IdRegistry", () => {
	const options = { fields: 2, segmented: true };

	it("writes a file per group and never touches one it wrote", () => {
		const directory = temporary();
		const first = load(directory, options);
		first.registry.assignIn("ward/2023", "ward", "A");
		first.registry.assignIn("ward/2023", "ward", "B");
		first.registry.assignIn("lad/2023", "lad", "A");
		saveRegistry(directory, first);
		const dir = join(directory, "t");
		expect(readdirSync(join(dir, "ward"))).toEqual(["2023.txt"]);
		const written = readFileSync(join(dir, "ward/2023.txt"), "utf8");
		expect(written).toContain("@ward\n=1\nA\nB\n");

		// A key for a release that has a file goes to a new one beside it.
		const second = load(directory, options);
		expect(second.registry.assignIn("ward/2023", "ward", "C")).toBe(4);
		expect(second.registry.assignIn("ward/2024", "ward", "D")).toBe(5);
		saveRegistry(directory, second);
		expect(readdirSync(join(dir, "ward")).sort()).toEqual([
			"2023+4.txt",
			"2023.txt",
			"2024.txt",
		]);
		expect(readFileSync(join(dir, "ward/2023.txt"), "utf8")).toBe(written);

		const { registry } = load(directory, options);
		expect(registry.size).toBe(5);
		expect(
			[...registry.entries()].map((entry) => entry.key.join("/")),
		).toEqual(["ward/A", "ward/B", "lad/A", "ward/C", "ward/D"]);
	});

	it("keeps ids that are not next to each other in one file", () => {
		const directory = temporary();
		const first = load(directory, options);
		first.registry.assignIn("g/r1", "g", "A");
		first.registry.assignIn("g/r2", "g", "A2");
		// Met later, for the first release again.
		first.registry.assignIn("g/r1", "g", "B");
		saveRegistry(directory, first);
		const text = readFileSync(join(directory, "t/g/r1.txt"), "utf8");
		expect(text).toContain("@g\n=1\nA\n=3\nB\n");
		const { registry } = load(directory, options);
		expect([
			registry.id("g", "A"),
			registry.id("g", "A2"),
			registry.id("g", "B"),
		]).toEqual([1, 2, 3]);
	});

	it("finds a file deleted, copied or edited", () => {
		const directory = temporary();
		const first = load(directory, options);
		first.registry.assignIn("a/1", "a", "X");
		first.registry.assignIn("b/1", "b", "X");
		first.registry.assignIn("c/1", "c", "X");
		saveRegistry(directory, first);
		const dir = join(directory, "t");
		const b = readFileSync(join(dir, "b/1.txt"), "utf8");
		rmSync(join(dir, "b/1.txt"));
		expect(() => load(directory, options)).toThrow(/missing ids 2 to 2/);
		writeFileSync(join(dir, "b/1.txt"), b);
		mkdirSync(join(dir, "d"));
		writeFileSync(join(dir, "d/1.txt"), b.replace("b", "d"));
		expect(() => load(directory, options)).toThrow(
			/gives id 2 to more than one key/,
		);
	});

	it("refuses a group that is not a safe file name", () => {
		const directory = temporary();
		const loaded = load(directory, options);
		loaded.registry.assignIn("../escape", "a", "X");
		expect(() => saveRegistry(directory, loaded)).toThrow(
			/cannot name a file/,
		);
		expect(existsSync(join(directory, "escape.txt"))).toBe(false);
	});

	it("refuses to save when another build added a file", () => {
		const directory = temporary();
		const mine = load(directory, options);
		const theirs = load(directory, options);
		theirs.registry.assignIn("a/1", "a", "X");
		saveRegistry(directory, theirs);
		mine.registry.assignIn("b/1", "b", "Y");
		expect(() => saveRegistry(directory, mine)).toThrow(
			/changed while it was in use/,
		);
	});
});

describe("checkAppendOnly", () => {
	it("accepts added lines and refuses any edit to the ones there", () => {
		expect(checkAppendOnly("a\nb\n", "a\nb\nc\n")).toBe(true);
		expect(checkAppendOnly("a\nb\n", "a\nb\n")).toBe(true);
		expect(checkAppendOnly("a\nb\n", "a\nc\nb\n")).toBe(false);
		expect(checkAppendOnly("a\nb\n", "b\n")).toBe(false);
		expect(checkAppendOnly("a\nb\n", "a\nbb\n")).toBe(false);
	});
});

describe("registryProblems", () => {
	const files = (entries: Record<string, string>) =>
		new Map(Object.entries(entries));

	it("lets a small registry grow at its end and a segmented one gain files", () => {
		expect(
			registryProblems(
				files({
					"measure.txt": "a\nb\n",
					"area/ward/2023.txt": "x\n",
					"area/ward/2024.txt": "y\n",
				}),
				files({ "measure.txt": "a\n", "area/ward/2023.txt": "x\n" }),
			),
		).toEqual([]);
	});

	it("refuses a segmented file that changed, even only by appending", () => {
		const problems = registryProblems(
			files({ "area-version/ward/2023.txt": "x\ny\n" }),
			files({ "area-version/ward/2023.txt": "x\n" }),
		);
		expect(problems).toHaveLength(1);
		expect(problems[0]).toMatch(/written once/);
	});

	it("refuses a removed file and an edited small registry", () => {
		const problems = registryProblems(
			files({ "measure.txt": "b\na\n" }),
			files({
				"measure.txt": "a\nb\n",
				"area/ward/2023.txt": "x\n",
				"party.txt": "p\n",
			}),
		);
		expect(problems.length).toBe(3);
	});
});

describe("IdRegistries", () => {
	it("is empty in memory and saves nothing", () => {
		const registries = IdRegistries.memory();
		expect(registries.empty).toBe(true);
		expect(registries.release.assign("lad", "2024")).toBe(0);
		expect(registries.geography.assign("lad")).toBe(1);
		expect(registries.save()).toEqual([]);
	});

	it("keeps ids between loads", () => {
		const directory = join(temporary(), "ids");
		const first = IdRegistries.load(directory);
		first.release.assign("lad", "2023");
		first.release.assign("lad", "2024");
		first.measure.assign("population");
		first.areaVersion.assign("lad", "2023", "E1");
		first.save();
		const second = IdRegistries.load(directory);
		expect(second.release.id("lad", "2024")).toBe(1);
		expect(second.release.assign("lad", "2022")).toBe(2);
		expect(second.areaVersion.id("lad", "2023", "E1")).toBe(1);
		expect(second.added.release).toBe(1);
		expect(second.added.measure).toBe(0);
		expect(existsSync(join(directory, "area-version/lad/2023.txt"))).toBe(
			true,
		);
	});
});
