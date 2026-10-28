import {
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
	rmSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	readAreaSourceAdapters,
	type AreaSourceAdapterManifest,
} from "@uk-data-atlas/atlas-runtime/areas";
import { sourceGeoJsonPath } from "./boundarySourcePaths";
import {
	artifactDirectory,
	configDirectory,
} from "@uk-data-atlas/atlas-runtime/storage";

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
		artifactDirectory(repositoryRoot),
		"boundaries",
	);
	if (!existsSync(artifactDirectory(repositoryRoot))) {
		throw new Error(
			"Create the API public directory before building derived boundaries.",
		);
	}
	for (const [identity, adapter] of Object.entries(adapters)) {
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
	}
	rmSync(join(artifactDirectory(repositoryRoot), "derived-boundaries.json"), {
		force: true,
	});
	return { releaseCount: Object.keys(adapters).length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildDerivedBoundaries(
		repositoryRoot,
		readAreaSourceAdapters(
			join(configDirectory(repositoryRoot), "area-source-adapters.json"),
		),
	);
	console.log(`Wrote ${result.releaseCount} derived boundary releases`);
}
