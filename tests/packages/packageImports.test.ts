import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Check dependencies explicitly because workspace resolution can otherwise
 * allow imports from packages that are only installed at the repository root.
 * Browser-safe packages must also avoid Node built-ins.
 */
const PACKAGES = join(process.cwd(), "packages");

const sourceFiles = (directory: string): string[] =>
	readdirSync(directory).flatMap((name) => {
		const path = join(directory, name);
		if (statSync(path).isDirectory()) return sourceFiles(path);
		return /\.(ts|tsx|mts)$/.test(name) ? [path] : [];
	});

const SPECIFIER =
	/(?:^|[\s;])(?:import|export)\b[^"'`;]*?\bfrom\s*["']([^"']+)["']|(?:^|[\s;])import\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)|\brequire\(\s*["']([^"']+)["']\s*\)/g;

const specifiers = (source: string) =>
	[...source.matchAll(SPECIFIER)].map(
		(match) => match[1] ?? match[2] ?? match[3] ?? match[4]!,
	);

/** `@scope/name/sub` and `name/sub` both name a package by their first part. */
const packageName = (specifier: string) =>
	specifier
		.split("/")
		.slice(0, specifier.startsWith("@") ? 2 : 1)
		.join("/");

const builtins = new Set(builtinModules);

const problems = (packageRoot: string) => {
	const manifest = JSON.parse(
		readFileSync(join(packageRoot, "package.json"), "utf8"),
	);
	const declared = new Set(
		["dependencies", "peerDependencies", "devDependencies"].flatMap(
			(field) => Object.keys(manifest[field] ?? {}),
		),
	);
	const found: string[] = [];
	for (const file of sourceFiles(join(packageRoot, "src"))) {
		const where = relative(process.cwd(), file);
		for (const specifier of specifiers(readFileSync(file, "utf8"))) {
			if (specifier.startsWith(".")) {
				const target = resolve(dirname(file), specifier);
				if (relative(packageRoot, target).startsWith(".."))
					found.push(
						`${where} reaches outside its package: ${specifier}`,
					);
				continue;
			}
			if (specifier.startsWith("node:") || builtins.has(specifier)) {
				const nodeOnly =
					["artifacts", "atlas-runtime", "shapefile"].includes(
						manifest.name.replace("@uk-data-atlas/", ""),
					) ||
					(manifest.name === "@uk-data-atlas/search-index" &&
						inside(join(packageRoot, "src/node"), file));
				if (!nodeOnly)
					found.push(
						`${where} imports a Node built-in: ${specifier}`,
					);
				continue;
			}
			const name = packageName(specifier);
			// A types-only package such as `geojson` is declared as @types/geojson.
			const types = name.startsWith("@")
				? `@types/${name.slice(1).replace("/", "__")}`
				: `@types/${name}`;
			if (!declared.has(name) && !declared.has(types))
				found.push(`${where} imports undeclared ${specifier}`);
		}
	}
	return found;
};

describe("shared packages", () => {
	const packages = readdirSync(PACKAGES).filter((name) =>
		statSync(join(PACKAGES, name, "package.json"), {
			throwIfNoEntry: false,
		})?.isFile(),
	);

	it("are found", () => {
		expect(packages).toContain("geography");
	});

	it.each(packages)(
		"%s imports only its own files and declared dependencies",
		(name) => {
			expect(problems(join(PACKAGES, name))).toEqual([]);
		},
	);

	it("catches an import the package does not declare", () => {
		expect(
			specifiers(
				[
					'import { useState } from "react";',
					'import type { Feature } from "geojson";',
					'export * from "./mappings";',
					'const fs = await import("node:fs");',
				].join("\n"),
			),
		).toEqual(["react", "geojson", "./mappings", "node:fs"]);
	});
});

const inside = (directory: string, file: string) => {
	const path = relative(directory, file);
	return path === "" || (!path.startsWith("..") && !path.startsWith("/"));
};

const ROOT = process.cwd();
const PIPELINE = join(ROOT, "pipeline");

const pipelineImportAllowed = (
	file: string,
	specifier: string,
	declared: Set<string>,
) => {
	if (specifier.startsWith(".")) {
		const target = resolve(dirname(file), specifier);
		return inside(PIPELINE, target) || inside(PACKAGES, target);
	}
	return (
		specifier.startsWith("node:") ||
		builtins.has(specifier) ||
		(declared.has(packageName(specifier)) &&
			!["uk-data-atlas", "@uk-data-atlas/api"].includes(
				packageName(specifier),
			))
	);
};

const ATLAS_API = join(PACKAGES, "atlas-runtime/src/api");

const importsAtlasApi = (file: string, specifier: string) =>
	specifier === "@uk-data-atlas/atlas-runtime/api" ||
	specifier.startsWith("@uk-data-atlas/atlas-runtime/api/") ||
	(specifier.startsWith(".") &&
		inside(ATLAS_API, resolve(dirname(file), specifier)));

describe("extracted domain packages", () => {
	it.each(["areas", "relationships", "geometry", "places", "measures"])(
		"%s has no runtime or storage dependency",
		(name) => {
			const manifest = JSON.parse(
				readFileSync(join(PACKAGES, name, "package.json"), "utf8"),
			);
			const dependencies = Object.keys(manifest.dependencies ?? {});
			expect(dependencies).not.toContain("@uk-data-atlas/atlas-runtime");
			const files = sourceFiles(join(PACKAGES, name, "src"));
			expect(files.length).toBeGreaterThan(0);
			const imports = files.flatMap((file) =>
				specifiers(readFileSync(file, "utf8")),
			);
			expect(
				imports.filter(
					(specifier) =>
						specifier.startsWith("node:sqlite") ||
						specifier.startsWith("@uk-data-atlas/atlas-runtime"),
				),
			).toEqual([]);
		},
	);
});

describe("atlas domain boundaries", () => {
	it("keeps domain modules and evidence loading independent of the API", () => {
		const atlas = join(PACKAGES, "atlas-runtime/src");
		const files = [
			...[
				"areas",
				"catalogue",
				"relationships",
				"geometry",
				"places",
				"postcodes",
				"storage",
				"maps",
			].flatMap((directory) => sourceFiles(join(atlas, directory))),
			...sourceFiles(join(PIPELINE, "src/evidence")),
			join(PIPELINE, "src/build-evidence-documents.ts"),
		];
		expect(files.length).toBeGreaterThan(1);
		const invalid = files.flatMap((file) =>
			specifiers(readFileSync(file, "utf8"))
				.filter((specifier) => importsAtlasApi(file, specifier))
				.map((specifier) => `${relative(ROOT, file)}: ${specifier}`),
		);
		expect(invalid).toEqual([]);
	});

	it("recognises API imports through relative paths and package exports", () => {
		const file = join(PACKAGES, "atlas-runtime/src/areas/example.ts");
		expect(importsAtlasApi(file, "../api/routing")).toBe(true);
		expect(importsAtlasApi(file, "@uk-data-atlas/atlas-runtime/api")).toBe(
			true,
		);
		expect(importsAtlasApi(file, "../catalogue/measureContext")).toBe(
			false,
		);
	});
});

describe("pipeline boundaries", () => {
	it("does not retain the former shared directory", () => {
		expect(existsSync(join(ROOT, "shared"))).toBe(false);
	});

	it("imports only its own code, packages, built-ins and declared dependencies", () => {
		const manifest = JSON.parse(
			readFileSync(join(PIPELINE, "package.json"), "utf8"),
		);
		const declared = new Set<string>(
			Object.keys(manifest.dependencies ?? {}),
		);
		const files = sourceFiles(join(PIPELINE, "src"));
		expect(files.length).toBeGreaterThan(0);
		const invalid = files.flatMap((file) =>
			specifiers(readFileSync(file, "utf8"))
				.filter(
					(specifier) =>
						!pipelineImportAllowed(file, specifier, declared),
				)
				.map((specifier) => `${relative(ROOT, file)}: ${specifier}`),
		);
		expect(invalid).toEqual([]);
	});

	it("rejects product imports regardless of relative paths or aliases", () => {
		const file = join(PIPELINE, "src/build.ts");
		for (const specifier of [
			"../../services/api/src/catalogueLoader",
			"../../lib/atlas",
			"@/lib/atlas",
			"@uk-data-atlas/api",
			"uk-data-atlas",
		]) {
			expect(
				pipelineImportAllowed(
					file,
					specifier,
					new Set(["@uk-data-atlas/api", "uk-data-atlas"]),
				),
			).toBe(false);
		}
	});

	it("finds the API project and its output through packages/atlas-runtime/src/storage/dataLayout.ts", () => {
		const files = [
			...sourceFiles(join(PIPELINE, "src")),
			...sourceFiles(join(PACKAGES, "atlas-runtime/src")),
		].filter(
			(file) =>
				relative(ROOT, file) !==
				"packages/atlas-runtime/src/storage/dataLayout.ts",
		);
		expect(files.length).toBeGreaterThan(0);
		const hardCoded = files.filter((file) =>
			/["'`][^"'`\n]*services\/api(?:[\/"'`])|"services",\s*"api"/.test(
				readFileSync(file, "utf8"),
			),
		);
		expect(hardCoded.map((file) => relative(ROOT, file))).toEqual([]);
	});

	it("lets root data scripts reach API code only to exercise its routes", () => {
		const files = readdirSync(join(ROOT, "scripts")).filter((name) =>
			/^(verify|place|compile|build)-.*\.(ts|mts)$/.test(name),
		);
		expect(files.length).toBeGreaterThan(0);
		const apiImports = files.flatMap((name) =>
			specifiers(readFileSync(join(ROOT, "scripts", name), "utf8"))
				.filter((specifier) => specifier.includes("services/api"))
				.map((specifier) => `${name}: ${specifier}`),
		);
		expect(
			apiImports.filter(
				(entry) =>
					!/\.\.\/services\/api\/(src\/routes|tests\/routeFixtures)$/.test(
						entry,
					),
			),
		).toEqual([]);
	});

	it("keeps the API, website runtime and packages independent of the pipeline", () => {
		const files = [
			"app",
			"components",
			"lib",
			"services/api/src",
			"services/api/scripts",
		].flatMap((directory) => sourceFiles(join(ROOT, directory)));
		for (const name of readdirSync(PACKAGES))
			files.push(...sourceFiles(join(PACKAGES, name, "src")));
		expect(files.length).toBeGreaterThan(0);
		const invalid = files.flatMap((file) =>
			specifiers(readFileSync(file, "utf8"))
				.filter(
					(specifier) =>
						packageName(specifier) === "@uk-data-atlas/pipeline" ||
						inside(
							PIPELINE,
							specifier.startsWith(".")
								? resolve(dirname(file), specifier)
								: resolve(ROOT, specifier.replace(/^@\//, "")),
						),
				)
				.map((specifier) => `${relative(ROOT, file)}: ${specifier}`),
		);
		expect(invalid).toEqual([]);
	});
});

describe("MCP server boundaries", () => {
	const MCP = join(ROOT, "services/mcp");

	it("talks to the API over HTTP and imports none of the repository's code", () => {
		const manifest = JSON.parse(
			readFileSync(join(MCP, "package.json"), "utf8"),
		);
		const declared = new Set<string>(
			Object.keys(manifest.dependencies ?? {}),
		);
		const files = sourceFiles(join(MCP, "src"));
		expect(files.length).toBeGreaterThan(0);
		const invalid = files.flatMap((file) =>
			specifiers(readFileSync(file, "utf8"))
				.filter((specifier) =>
					specifier.startsWith(".")
						? !inside(
								join(MCP, "src"),
								resolve(dirname(file), specifier),
							)
						: !(
								specifier.startsWith("node:") ||
								builtins.has(specifier) ||
								declared.has(packageName(specifier))
							) ||
							packageName(specifier).startsWith(
								"@uk-data-atlas/",
							),
				)
				.map((specifier) => `${relative(ROOT, file)}: ${specifier}`),
		);
		expect(invalid).toEqual([]);
	});
});
