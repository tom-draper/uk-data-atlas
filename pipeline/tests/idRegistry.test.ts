import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { IdRegistries } from "../src/ids/idRegistries.ts";
import { IdRegistry, checkAppendOnly } from "../src/ids/idRegistry.ts";

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
		const path = join(directory, "t.txt");
		const first = new IdRegistry("t", { first: 1, fields: 3 });
		const keys = [
			["lad", "2023", "E1"],
			["lad", "2023", "E2"],
			["ward", "2023", "W1"],
			["lad", "2023", "E3"],
		];
		const ids = keys.map((key) => first.assign(...key));
		first.save(path);
		const text = readFileSync(path, "utf8");
		expect(text).toContain(
			"@lad\t2023\nE1\nE2\n@ward\t2023\nW1\n@lad\t2023\nE3\n",
		);

		const second = new IdRegistry("t", {
			first: 1,
			fields: 3,
			text,
		});
		expect(keys.map((key) => second.id(...key))).toEqual(ids);
		// A new key goes last whatever its code sorts to.
		expect(second.assign("lad", "2023", "E0")).toBe(5);
		expect(second.assign("ward", "2024", "W1")).toBe(6);
		second.save(path);
		const grown = readFileSync(path, "utf8");
		expect(checkAppendOnly(text, grown)).toBe(true);

		const third = new IdRegistry("t", { first: 1, fields: 3, text: grown });
		expect(keys.map((key) => third.id(...key))).toEqual(ids);
		expect(third.id("lad", "2023", "E0")).toBe(5);
		expect(third.id("ward", "2024", "W1")).toBe(6);
		expect(third.keyOf(6)).toEqual(["ward", "2024", "W1"]);
		expect([...third.entries()].map((entry) => entry.id)).toEqual([
			1, 2, 3, 4, 5, 6,
		]);
	});

	it("saves twice without writing anything twice", () => {
		const path = join(temporary(), "t.txt");
		const registry = new IdRegistry("t", { first: 1, fields: 2 });
		registry.assign("a", "1");
		registry.save(path);
		registry.assign("a", "2");
		registry.assign("b", "1");
		registry.save(path);
		registry.save(path);
		const reread = new IdRegistry("t", {
			first: 1,
			fields: 2,
			text: readFileSync(path, "utf8"),
		});
		expect([...reread.entries()]).toEqual([
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
		const path = join(temporary(), "t.txt");
		const registry = new IdRegistry("t", { first: 1, fields: 1 });
		registry.assign("a");
		registry.save(path);
		const other = new IdRegistry("t", {
			first: 1,
			fields: 1,
			text: readFileSync(path, "utf8"),
		});
		writeFileSync(path, readFileSync(path, "utf8") + "z\n");
		other.assign("b");
		expect(() => other.save(path)).toThrow(/changed while it was in use/);
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

describe("checkAppendOnly", () => {
	it("accepts added lines and refuses any edit to the ones there", () => {
		expect(checkAppendOnly("a\nb\n", "a\nb\nc\n")).toBe(true);
		expect(checkAppendOnly("a\nb\n", "a\nb\n")).toBe(true);
		expect(checkAppendOnly("a\nb\n", "a\nc\nb\n")).toBe(false);
		expect(checkAppendOnly("a\nb\n", "b\n")).toBe(false);
		expect(checkAppendOnly("a\nb\n", "a\nbb\n")).toBe(false);
	});
});

describe("IdRegistries", () => {
	it("is empty in memory and saves nothing", () => {
		const registries = IdRegistries.memory();
		expect(registries.empty).toBe(true);
		expect(registries.release.assign("lad", "2024")).toBe(0);
		expect(registries.geography.assign("lad")).toBe(1);
		registries.save();
	});

	it("keeps ids between loads", () => {
		const directory = join(temporary(), "ids");
		const first = IdRegistries.load(directory);
		first.release.assign("lad", "2023");
		first.release.assign("lad", "2024");
		first.measure.assign("population");
		first.save();
		const second = IdRegistries.load(directory);
		expect(second.release.id("lad", "2024")).toBe(1);
		expect(second.release.assign("lad", "2022")).toBe(2);
		expect(second.added.release).toBe(1);
		expect(second.added.measure).toBe(0);
	});
});
