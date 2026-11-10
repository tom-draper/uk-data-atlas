import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { expect, it } from "vitest";
import { findCycle, sourceFiles, specifiers } from "../helpers/sourceImports";

/**
 * TEMPORARY. This test exists only while `packages/atlas-runtime` is being
 * dissolved into domain packages (see docs/packages-refactor.md). Delete it
 * once atlas-runtime is gone.
 *
 * It fails on import cycles between the folders of `atlas-runtime/src`, so the
 * folders can later become packages without a cycle between them. Cycles are
 * tolerated by naming the import that closes each. A new cycle fails, and so
 * does an exception that no longer closes anything.
 */
const SRC = join(process.cwd(), "packages/atlas-runtime/src");

/** `from -> to`: folder `from` imports folder `to`, closing a cycle. */
const KNOWN_CYCLE_CLOSING_IMPORTS: string[] = [];

const folderImports = () => {
	const edges = new Map<string, Set<string>>();
	for (const file of sourceFiles(SRC)) {
		const from = relative(SRC, file).split("/")[0]!;
		for (const specifier of specifiers(readFileSync(file, "utf8"))) {
			if (!specifier.startsWith(".")) continue;
			const to = relative(SRC, resolve(dirname(file), specifier)).split(
				"/",
			)[0]!;
			if (to === from || to.startsWith("..")) continue;
			edges.set(from, (edges.get(from) ?? new Set()).add(to));
		}
	}
	return edges;
};

it("has no import cycles between atlas-runtime folders beyond the known ones", () => {
	const edges = folderImports();
	const found = [...edges].flatMap(([from, targets]) =>
		[...targets].map((to) => `${from} -> ${to}`),
	);
	const known = new Set(KNOWN_CYCLE_CLOSING_IMPORTS);
	expect(
		KNOWN_CYCLE_CLOSING_IMPORTS.filter((edge) => !found.includes(edge)),
		"known cycle-closing imports that no longer exist, remove them",
	).toEqual([]);
	const graph = new Map(
		[...edges].map(([from, targets]) => [
			from,
			[...targets].filter((to) => !known.has(`${from} -> ${to}`)),
		]),
	);
	expect(findCycle(graph)?.join(" > ")).toBeUndefined();
});

it("keeps loader at the top, imported by no other atlas-runtime folder", () => {
	const importers = [...folderImports()]
		.filter(([from, targets]) => targets.has("loader"))
		.map(([from]) => from);
	expect(importers, "folders importing loader").toEqual([]);
});

it("keeps extracted domains out of runtime folder imports", () => {
	const edges = folderImports();
	for (const name of [
		"places",
		"postcodes",
		"measures",
		"catalogue",
		"maps",
	]) {
		expect([...edges.keys()]).not.toContain(name);
		for (const targets of edges.values())
			expect([...targets]).not.toContain(name);
	}
});
