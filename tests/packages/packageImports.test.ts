import { readdirSync, readFileSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The shared packages are bundled into the browser and imported by the API,
 * so their source may only import its own files and the dependencies its
 * package.json declares. Inside the repository Node resolves anything the
 * root has installed, so nothing else stops a package reaching for React or
 * the atlas's code; a package's tsconfig already rejects Node and DOM types
 * and the atlas's path aliases.
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
				found.push(`${where} imports a Node built-in: ${specifier}`);
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
