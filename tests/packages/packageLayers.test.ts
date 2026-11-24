import { existsSync, readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { findCycle, sourceFiles, specifiers } from "../helpers/sourceImports";

/**
 * The layer order from packages/README.md. A package may import only packages
 * in a lower layer, and the L0 packages import none of each other. Keep this
 * table in step with the README.
 */
const LAYERS: Record<string, number> = {
	geography: 0,
	artifacts: 0,
	datasets: 0,
	"atlas-db": 1,
	geometry: 2,
	areas: 3,
	relationships: 4,
	measures: 5,
	catalogue: 6,
	places: 7,
	"atlas-loader": 8,
};

/** Packages whose every entry runs in the browser. */
const BROWSER_SAFE = ["geography", "datasets"];

const PREFIX = "@uk-data-atlas/";
const PACKAGES = join(process.cwd(), "packages");
const builtins = new Set(builtinModules);

const names = readdirSync(PACKAGES).filter((name) =>
	existsSync(join(PACKAGES, name, "package.json")),
);

/** The workspace package a specifier names, or undefined for anything else. */
const workspacePackage = (specifier: string) =>
	specifier.startsWith(PREFIX)
		? specifier.slice(PREFIX.length).split("/")[0]
		: undefined;

const manifestOf = (name: string) =>
	JSON.parse(readFileSync(join(PACKAGES, name, "package.json"), "utf8"));

/** The workspace packages a manifest declares, by short name. */
const declaredWorkspace = (name: string) => {
	const manifest = manifestOf(name);
	return [
		...new Set(
			["dependencies", "peerDependencies", "devDependencies"].flatMap(
				(field) =>
					Object.keys(manifest[field] ?? {}).flatMap((dependency) =>
						dependency.startsWith(PREFIX)
							? [dependency.slice(PREFIX.length)]
							: [],
					),
			),
		),
	];
};

const upward = (from: string, to: string) => {
	if (!(to in LAYERS)) return `${to} has no layer in LAYERS`;
	if (LAYERS[to]! < LAYERS[from]!) return undefined;
	return `${from} (L${LAYERS[from]}) may not depend on ${to} (L${LAYERS[to]})`;
};

/** Every workspace package a package's source imports, with where. */
const sourceImports = (name: string) =>
	sourceFiles(join(PACKAGES, name, "src")).flatMap((file) =>
		specifiers(readFileSync(file, "utf8")).map((specifier) => ({
			where: relative(process.cwd(), file),
			specifier,
		})),
	);

describe("package layers", () => {
	it("gives every package a layer", () => {
		expect([...names].sort()).toEqual(Object.keys(LAYERS).sort());
	});

	it.each(names)("%s depends only on lower layers", (name) => {
		const problems = declaredWorkspace(name).flatMap((dependency) => {
			const problem = upward(name, dependency);
			return problem ? [`${name}/package.json: ${problem}`] : [];
		});
		expect(problems).toEqual([]);
	});

	it.each(names)("%s imports only lower layers it declares", (name) => {
		const declared = new Set(declaredWorkspace(name));
		const problems = sourceImports(name).flatMap(({ where, specifier }) => {
			const target = workspacePackage(specifier);
			if (target === undefined || target === name) return [];
			const problem = upward(name, target);
			if (problem) return [`${where}: ${problem}`];
			return declared.has(target)
				? []
				: [`${where}: ${target} is not declared in ${name}`];
		});
		expect(problems).toEqual([]);
	});

	it("has no dependency cycle", () => {
		const graph = new Map(
			names.map((name) => [name, declaredWorkspace(name)]),
		);
		expect(findCycle(graph)).toBeUndefined();
	});

	it.each(BROWSER_SAFE)(
		"%s imports no Node built-in and no Node-only package",
		(name) => {
			const problems = [
				...declaredWorkspace(name).flatMap((dependency) =>
					BROWSER_SAFE.includes(dependency)
						? []
						: [`${name}/package.json declares ${dependency}`],
				),
				...sourceImports(name).flatMap(({ where, specifier }) => {
					if (
						specifier.startsWith("node:") ||
						builtins.has(specifier)
					)
						return [`${where} imports ${specifier}`];
					const target = workspacePackage(specifier);
					return target !== undefined &&
						target !== name &&
						!BROWSER_SAFE.includes(target)
						? [`${where} imports ${specifier}`]
						: [];
				}),
			];
			expect(problems).toEqual([]);
		},
	);
});
