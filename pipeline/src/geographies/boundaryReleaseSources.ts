import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { BOUNDARY_CATALOG, BOUNDARY_TYPES } from "@uk-data-atlas/datasets";
import {
	parseGridOffset,
	reversedOffsetsFor,
	substitutionsFor,
} from "@uk-data-atlas/geography";
import { parseDatasetMeta } from "@uk-data-atlas/datasets";

const ROOT = resolve(import.meta.dirname, "../../..");
export const PROPERTIES_FILENAME = "properties.json";

/**
 * The GeoJSON a release is compiled from, named by its own meta.json.
 *
 * Sources keep the filename the publisher gave them, so that someone
 * searching for a published boundary file finds this repository. The name
 * therefore differs per release and cannot be hardcoded — the one exception
 * being a GeoJSON this project converted itself, which never had a published
 * name and stays `source.geojson`. A release's meta lists exactly one GeoJSON
 * that is not a lookup or a companion, and that is the one to read.
 */
const readReleaseMeta = (releaseDir: string) =>
	parseDatasetMeta(
		JSON.parse(readFileSync(join(releaseDir, "meta.json"), "utf8")),
		basename(releaseDir),
	);

/**
 * The corrections a release's meta.json declares, loaded from their
 * definitions in data/source/boundaries/, with the paths that define them so a
 * change to either recompiles the release.
 */
const correctionsFromMeta = (releaseDir: string) =>
	(readReleaseMeta(releaseDir).corrections ?? []).map((id) => {
		const path = join(ROOT, "data/source", "boundaries", `${id}.json`);
		return {
			path,
			offset: parseGridOffset(
				JSON.parse(readFileSync(path, "utf8")),
				path,
			),
		};
	});

const sourceFromMeta = (releaseDir: string, label: string): string | null => {
	const meta = readReleaseMeta(releaseDir);
	const sources = meta.files.filter(
		(file) =>
			file.path.endsWith(".geojson") &&
			(file.role === "source" || file.role === "derived"),
	);
	// A release published only as TopoJSON, or converted outside this repo,
	// lists no GeoJSON at all. Its geometry remains unreproducible here, but
	// the caller can still derive a properties sidecar from that topology.
	if (sources.length === 0) return null;
	if (sources.length > 1) {
		throw new Error(
			`${label}: meta.json lists ${sources.length} source GeoJSON files, expected one`,
		);
	}
	return join(releaseDir, sources[0]!.path);
};

/** Where a catalogue release's meta.json and source GeoJSON live in data/. */
const releaseDirFor = (asset: string) =>
	dirname(
		join(
			ROOT,
			"data/source",
			// withCDN appends a version query outside development.
			asset.split("?")[0]!.replace(/^\/data\//, ""),
		),
	);

/**
 * The donor releases a release's geometry substitutions read from, resolved
 * through the catalogue so each donor is decoded with its own code property
 * and corrections.
 */
const substitutionSources = (type: string, releaseId: string) =>
	substitutionsFor(type, releaseId).map((substitution) => {
		const { geography, boundaryRelease } = substitution.donor;
		const label = `${geography}/${boundaryRelease}`;
		const donor = BOUNDARY_CATALOG[
			geography as keyof typeof BOUNDARY_CATALOG
		]?.releases.find((release) => release.id === boundaryRelease);
		if (!donor?.asset)
			throw new Error(
				`${type}/${releaseId}: ${substitution.id} names ${label}, which the catalogue does not serve.`,
			);
		const releaseDir = releaseDirFor(donor.asset);
		const sourcePath = sourceFromMeta(releaseDir, label);
		if (!sourcePath)
			throw new Error(
				`${type}/${releaseId}: ${substitution.id} names ${label}, which has no GeoJSON source.`,
			);
		const corrections = correctionsFromMeta(releaseDir);
		return {
			substitution,
			label,
			codeKey: donor.codeKey,
			sourcePath,
			offsets: corrections.map(({ offset }) => offset),
			inputs: [
				sourcePath,
				join(releaseDir, "meta.json"),
				...corrections.map(({ path }) => path),
			],
		};
	});

export type SubstitutionSource = ReturnType<typeof substitutionSources>[number];

/**
 * The grid offsets a WGS84 release carries backwards, loaded from their
 * definitions in data/source/boundaries/ as the forward corrections are.
 */
const reversedOffsetSources = (type: string, releaseId: string) =>
	reversedOffsetsFor(type, releaseId).map((reversed) => {
		const path = join(
			ROOT,
			"data/source",
			"boundaries",
			`${reversed.offset}.json`,
		);
		return {
			path,
			offset: parseGridOffset(
				JSON.parse(readFileSync(path, "utf8")),
				path,
			),
		};
	});

// A change to the substitution definitions recompiles the releases they name.
const SUBSTITUTIONS_MODULE = join(
	ROOT,
	"packages",
	"geography",
	"src",
	"geometrySubstitutions.ts",
);

/**
 * Every release the catalogue serves, paired with the published GeoJSON it is
 * compiled from. Derived from the catalogue rather than listed here, so adding
 * a release needs no change to this script.
 *
 * The properties to keep come from the release itself, not from its
 * geography. Filtering by a shared list is how the Dec 2020 ward and Dec 2015
 * constituency assets came to be written with every property stripped: the
 * list happened not to mention WD20CD, and spelled pcon15cd in the wrong case,
 * so the filter matched nothing and kept nothing.
 */
export const releaseSources = (outputDirectory: string) =>
	BOUNDARY_TYPES.flatMap((type) =>
		BOUNDARY_CATALOG[type].releases.flatMap((release) => {
			if (!release.asset) return [];
			// withCDN appends a version query outside development.
			const relative = release.asset
				.split("?")[0]!
				.replace(/^\/data\//, "");
			// The release folder in data/ holds the meta and the published
			// GeoJSON; the compiled asset is written straight to where it is
			// served from, rather than into data/ and copied across after.
			const releaseDir = dirname(join(ROOT, "data/source", relative));
			const outputPath = join(outputDirectory, relative);
			const propertiesPath = join(
				dirname(outputPath),
				PROPERTIES_FILENAME,
			);
			const metaPath = join(releaseDir, "meta.json");
			// A checked-out application can retain compiled releases while its
			// optional raw-source snapshot omits older boundary inputs. Preserve
			// those existing local assets; a release without either form is still
			// an error, rather than silently vanishing from the build.
			if (!existsSync(metaPath)) {
				if (existsSync(outputPath) && existsSync(propertiesPath))
					return [];
				throw new Error(
					`${type}/${release.id}: neither raw boundary metadata nor compiled assets are available`,
				);
			}
			const corrections = correctionsFromMeta(releaseDir);
			// A release that takes areas from another can only be recompiled
			// when that release's raw source is held too; otherwise its
			// local assets stand, as for a release missing its own.
			const donorsMissing = substitutionsFor(type, release.id).some(
				({ donor }) => {
					const asset = BOUNDARY_CATALOG[
						donor.geography as keyof typeof BOUNDARY_CATALOG
					]?.releases.find(
						({ id }) => id === donor.boundaryRelease,
					)?.asset;
					return (
						!asset ||
						!existsSync(join(releaseDirFor(asset), "meta.json"))
					);
				},
			);
			if (donorsMissing) {
				if (existsSync(outputPath) && existsSync(propertiesPath))
					return [];
				throw new Error(
					`${type}/${release.id}: the release it takes areas from has no raw source, and no compiled assets are available`,
				);
			}
			const substitutions = substitutionSources(type, release.id);
			const reversedOffsets = reversedOffsetSources(type, release.id);
			const repaired =
				substitutions.length > 0 || reversedOffsets.length > 0;
			return [
				{
					type,
					label: `${type}/${release.id}`,
					objectName: type,
					codeKey: release.codeKey,
					nameKey: release.nameKey,
					offsets: corrections.map(({ offset }) => offset),
					substitutions,
					reversedOffsets: reversedOffsets.map(
						({ offset }) => offset,
					),
					// The meta, any correction it declares and any release it takes
					// areas from change the output as surely as the source does.
					inputs: [
						metaPath,
						...corrections.map(({ path }) => path),
						...substitutions.flatMap(({ inputs }) => inputs),
						...reversedOffsets.map(({ path }) => path),
						...(repaired ? [SUBSTITUTIONS_MODULE] : []),
					],
					keep: new Set<string>([
						release.codeKey,
						release.nameKey,
						...(release.parentCodeKey
							? [release.parentCodeKey]
							: []),
					]),
					sourcePath: sourceFromMeta(
						releaseDir,
						`${type}/${release.id}`,
					),
					// A small number of releases are held only as TopoJSON. They
					// cannot be recompiled, but their existing topology is enough to
					// derive the sidecar the runtime reads.
					topologySourcePath: join(ROOT, "data/source", relative),
					outputPath,
					propertiesPath,
				},
			];
		}),
	).sort((a, b) => a.label.localeCompare(b.label));
