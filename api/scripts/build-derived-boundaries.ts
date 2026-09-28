import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	readAreaSourceAdapters,
	type AreaSourceAdapterManifest,
} from "../src/areaSourceAdapters";

type FeatureCollection = {
	type?: unknown;
	features?: Array<{ properties?: Record<string, unknown> }>;
};

type Metadata = { files?: unknown };

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

const toKebabCase = (value: string) =>
	value.replaceAll(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

const geoJsonPath = (directory: string) => {
	const metadata = JSON.parse(
		readFileSync(join(directory, "meta.json"), "utf8"),
	) as Metadata;
	if (!Array.isArray(metadata.files)) return undefined;
	const file = metadata.files.find(
		(candidate) =>
			typeof candidate === "object" &&
			candidate !== null &&
			(candidate as { role?: unknown }).role === "source" &&
			typeof (candidate as { path?: unknown }).path === "string" &&
			(candidate as { path: string }).path
				.toLowerCase()
				.endsWith(".geojson"),
	) as { path: string } | undefined;
	return file ? join(directory, file.path) : undefined;
};

export const buildDerivedBoundaries = (
	repositoryRoot: string,
	adapters: AreaSourceAdapterManifest,
) => {
	const outputDirectory = join(repositoryRoot, "api", "public", "boundaries");
	if (!existsSync(join(repositoryRoot, "api", "public"))) {
		throw new Error(
			"Create the API public directory before building derived boundaries.",
		);
	}
	const releases = Object.entries(adapters).map(([identity, adapter]) => {
		const [geography, boundaryRelease] = identity.split("/");
		const sourceDirectory = join(
			repositoryRoot,
			"data",
			"boundaries",
			toKebabCase(adapter.source.geography),
			adapter.source.boundaryRelease,
		);
		const path = geoJsonPath(sourceDirectory);
		if (!path || !existsSync(path)) {
			throw new Error(
				`${identity}: no declared GeoJSON source is available`,
			);
		}
		const source = JSON.parse(
			readFileSync(path, "utf8"),
		) as FeatureCollection;
		if (
			source.type !== "FeatureCollection" ||
			!Array.isArray(source.features)
		) {
			throw new Error(
				`${identity}: source is not a GeoJSON FeatureCollection`,
			);
		}
		const features = source.features.filter((feature) => {
			const value = feature.properties?.[adapter.filter.property];
			return (
				typeof value === "string" &&
				value.startsWith(adapter.filter.startsWith)
			);
		});
		if (features.length === 0) {
			throw new Error(
				`${identity}: source selection did not match any features`,
			);
		}
		const artifact = { type: "FeatureCollection", features };
		const content = `${JSON.stringify(artifact)}\n`;
		const directory = join(outputDirectory, geography);
		mkdirSync(directory, { recursive: true });
		const outputPath = join(directory, `${boundaryRelease}.geojson`);
		writeFileSync(outputPath, content);
		return {
			geography,
			boundaryRelease,
			artifact: `boundaries/${geography}/${boundaryRelease}.geojson`,
			featureCount: features.length,
			contentHash: sha256(content),
			derivedFrom: adapter,
		};
	});
	const manifest = { schemaVersion: 1, releases };
	const manifestPath = join(
		repositoryRoot,
		"api",
		"public",
		"derived-boundaries.json",
	);
	writeFileSync(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`);
	return { manifestPath, releaseCount: releases.length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildDerivedBoundaries(
		repositoryRoot,
		readAreaSourceAdapters(
			join(repositoryRoot, "api", "config", "area-source-adapters.json"),
		),
	);
	console.log(
		`Wrote ${result.releaseCount} derived boundary release to ${result.manifestPath}`,
	);
}
