import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	readAreaSourceAdapters,
	type AreaSourceAdapterManifest,
} from "../src/areaSourceAdapters";
import { sourceGeoJsonPath } from "../src/areaInventory";
import { sha256 } from "../src/contentHash";

type FeatureCollection = {
	type?: unknown;
	features?: Array<{ properties?: Record<string, unknown> }>;
};

const toKebabCase = (value: string) =>
	value.replaceAll(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

export const buildDerivedBoundaries = (
	repositoryRoot: string,
	adapters: AreaSourceAdapterManifest,
) => {
	const outputDirectory = join(
		repositoryRoot,
		"services",
		"api",
		"public",
		"boundaries",
	);
	if (!existsSync(join(repositoryRoot, "services", "api", "public"))) {
		throw new Error(
			"Create the API public directory before building derived boundaries.",
		);
	}
	const releases = Object.entries(adapters).map(([identity, adapter]) => {
		const [geography, boundaryRelease] = identity.split("/");
		const sourceDirectory = join(
			repositoryRoot,
			"data/source",
			"boundaries",
			toKebabCase(adapter.source.geography),
			adapter.source.boundaryRelease,
		);
		const path = sourceGeoJsonPath(sourceDirectory);
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
		"services",
		"api",
		"public",
		"derived-boundaries.json",
	);
	writeFileSync(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`);
	return { manifestPath, releaseCount: releases.length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../../..");
	const result = buildDerivedBoundaries(
		repositoryRoot,
		readAreaSourceAdapters(
			join(
				repositoryRoot,
				"services",
				"api",
				"config",
				"area-source-adapters.json",
			),
		),
	);
	console.log(
		`Wrote ${result.releaseCount} derived boundary release to ${result.manifestPath}`,
	);
}
