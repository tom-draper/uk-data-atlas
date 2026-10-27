import { buildArtifactPath } from "../../shared/geographyBuildPath";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
	BoundaryRegistry,
	BoundaryRelease,
} from "../../shared/boundaryRegistry";
import { sha256 } from "../../shared/contentHash";
import {
	boundaryReleaseDeprecations,
	sourceMetadataCorrections,
} from "@uk-data-atlas/catalogue";
import { artifactDirectory } from "../../shared/dataLayout";

type BoundaryMetadata = {
	id?: unknown;
	kind?: unknown;
	title?: unknown;
	description?: unknown;
	publisher?: unknown;
	sourceUrl?: unknown;
	retrieved?: unknown;
	temporalCoverage?: unknown;
	licence?: { name?: unknown; url?: unknown };
	spatialCoverage?: { geography?: unknown; countries?: unknown };
};

const stringValue = (
	value: unknown,
	field: string,
	location: string,
): string => {
	if (typeof value !== "string" || value.length === 0) {
		throw new Error(`${location}: ${field} must be a non-empty string`);
	}
	return value;
};

const optionalString = (value: unknown, field: string, location: string) => {
	if (value === undefined) return undefined;
	return stringValue(value, field, location);
};

const countryCodes = (value: unknown, location: string): string[] => {
	if (
		!Array.isArray(value) ||
		value.some((country) => typeof country !== "string")
	) {
		throw new Error(
			`${location}: spatialCoverage.countries must be strings`,
		);
	}
	return [...value].sort();
};

const readRelease = (metaPath: string): BoundaryRelease => {
	const raw = readFileSync(metaPath, "utf8");
	const metadata = JSON.parse(raw) as BoundaryMetadata;
	const location = metaPath.replace(/.*data\/source\/boundaries\//, "");
	const [directoryGeography, directoryRelease] = location.split("/");

	if (metadata.kind !== "boundary") {
		throw new Error(`${location}: kind must be boundary`);
	}
	const id = stringValue(metadata.id, "id", location);
	if (id !== directoryRelease) {
		throw new Error(`${location}: id does not match its directory name`);
	}
	const spatialCoverage = metadata.spatialCoverage;
	const geography = stringValue(
		spatialCoverage?.geography,
		"spatialCoverage.geography",
		location,
	);
	if (
		geography !==
		directoryGeography.replace(/-([a-z])/g, (_, letter) =>
			letter.toUpperCase(),
		)
	) {
		throw new Error(
			`${location}: geography does not match its directory name`,
		);
	}

	return {
		id,
		geography,
		title: stringValue(metadata.title, "title", location),
		...(optionalString(metadata.description, "description", location) ===
		undefined
			? {}
			: { description: metadata.description as string }),
		...(optionalString(
			metadata.temporalCoverage,
			"temporalCoverage",
			location,
		) === undefined
			? {}
			: { temporalCoverage: metadata.temporalCoverage as string }),
		coverage: {
			countries: countryCodes(spatialCoverage?.countries, location),
		},
		source: {
			publisher: stringValue(metadata.publisher, "publisher", location),
			url: stringValue(metadata.sourceUrl, "sourceUrl", location),
			...(optionalString(metadata.retrieved, "retrieved", location) ===
			undefined
				? {}
				: { retrievedAt: metadata.retrieved as string }),
			licence: {
				name: stringValue(
					metadata.licence?.name,
					"licence.name",
					location,
				),
				...(optionalString(
					metadata.licence?.url,
					"licence.url",
					location,
				) === undefined
					? {}
					: { url: metadata.licence?.url as string }),
			},
		},
		metadataHash: sha256(raw),
	};
};

export const createBoundaryRegistry = (
	repositoryRoot: string,
): BoundaryRegistry => {
	const boundariesRoot = join(repositoryRoot, "data/source", "boundaries");
	if (!existsSync(boundariesRoot)) {
		throw new Error(`No boundary source directory at ${boundariesRoot}`);
	}

	const releases = readdirSync(boundariesRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.flatMap((geography) => {
			const geographyDirectory = join(boundariesRoot, geography.name);
			return readdirSync(geographyDirectory, { withFileTypes: true })
				.filter((entry) => entry.isDirectory())
				.flatMap((release) => {
					if (
						sourceMetadataCorrections[
							`boundaries/${geography.name}/${release.name}`
						]?.kind === "lookup"
					)
						return [];
					const metaPath = join(
						geographyDirectory,
						release.name,
						"meta.json",
					);
					return existsSync(metaPath) ? [readRelease(metaPath)] : [];
				});
		})
		.map((release) => {
			const deprecation =
				boundaryReleaseDeprecations[
					`${release.geography}/${release.id}`
				];
			return deprecation ? { ...release, deprecation } : release;
		})
		.sort(
			(left, right) =>
				left.geography.localeCompare(right.geography) ||
				right.id.localeCompare(left.id),
		);
	const registryContent = JSON.stringify({ schemaVersion: 1, releases });

	return {
		schemaVersion: 1,
		contentHash: sha256(registryContent),
		releases,
	};
};

export const buildBoundaryRegistry = (repositoryRoot: string) => {
	const registry = createBoundaryRegistry(repositoryRoot);
	const outputDirectory = artifactDirectory(repositoryRoot);
	const outputPath = buildArtifactPath(
		repositoryRoot,
		"boundary-releases.json",
	);
	mkdirSync(dirname(outputPath), { recursive: true });
	mkdirSync(outputDirectory, { recursive: true });
	writeFileSync(outputPath, `${JSON.stringify(registry, null, "\t")}\n`);
	return { outputPath, releaseCount: registry.releases.length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const { outputPath, releaseCount } = buildBoundaryRegistry(repositoryRoot);
	console.log(`Wrote ${releaseCount} releases to ${outputPath}`);
}
