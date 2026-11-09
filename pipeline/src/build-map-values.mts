/**
 * Writes one code-aligned value array per (measure, boundary release, year)
 * under public/data/map-values, and a manifest naming each array's file and
 * the code list it was ordered by. See `@uk-data-atlas/map-tiles/mapValues`.
 *
 * Reads the compiled datasets in data/build/datasets and the boundary
 * properties sidecars in public/data/boundaries, so it runs after the
 * website-datasets stage. Run it alone with:
 *   pnpm exec tsx pipeline/src/build-map-values.mts
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
	BOUNDARY_CATALOG,
	propertiesAsset,
	type BoundaryType,
} from "@uk-data-atlas/datasets/data/boundaries/catalog";
import { CATALOGUE_DATASET_DEFINITIONS } from "@uk-data-atlas/datasets/data/catalog/registry";
import type { DatasetDefinition } from "@uk-data-atlas/datasets/data/catalog/types";
import {
	MAP_VALUES_SCHEMA_VERSION,
	codeListId,
	encodeMapValues,
	mapValuesKey,
	orderValues,
	releaseCodeList,
	type MapValuesEntry,
	type MapValuesManifest,
} from "@uk-data-atlas/map-tiles/mapValues";
import { ROOT } from "./precompile/paths.mts";

type CompiledDataset = {
	type: string;
	year: number;
	boundaryType: BoundaryType;
	boundaryYear: number;
	data: Record<string, Record<string, unknown> | undefined>;
};

type Definition = Pick<
	DatasetDefinition,
	"type" | "precompiledFile" | "boundaryType" | "mapValueField"
>;

export type BuildMapValuesPaths = {
	/** Folder of compiled datasets, one `<precompiledFile>.json` each. */
	datasetsDir: string;
	/** Folder holding `<geography>/<release>/properties.json`. */
	boundariesDir: string;
	outDir: string;
};

const sha256 = (text: string) =>
	createHash("sha256").update(text).digest("hex");

const readJson = async <T,>(path: string): Promise<T> =>
	JSON.parse(await readFile(path, "utf8")) as T;

/** The release a boundary year resolves to, and the folder holding its sidecar. */
function releaseFor(type: BoundaryType, boundaryYear: number) {
	const asset = BOUNDARY_CATALOG[type].vintages[boundaryYear];
	const release = BOUNDARY_CATALOG[type].releases.find(
		(candidate) => candidate.asset === asset,
	);
	if (!asset || !release)
		throw new Error(`No ${type} boundary release for ${boundaryYear}`);
	// Assets are served URLs under /data/boundaries; the sidecar is that folder's.
	return {
		release,
		properties: propertiesAsset(asset).replace(
			/^\/?data\/boundaries\//,
			"",
		),
	};
}

export async function buildMapValues(
	paths: BuildMapValuesPaths,
	definitions: readonly Definition[] = CATALOGUE_DATASET_DEFINITIONS,
): Promise<MapValuesManifest> {
	const entries: Record<string, MapValuesEntry> = {};
	const codeLists = new Map<string, string[]>();
	await rm(paths.outDir, { recursive: true, force: true });

	for (const definition of definitions) {
		const field = definition.mapValueField;
		if (!field) continue;
		const byYear = await readJson<Record<string, CompiledDataset>>(
			join(paths.datasetsDir, `${definition.precompiledFile}.json`),
		);
		for (const dataset of Object.values(byYear)) {
			if (dataset.boundaryType !== definition.boundaryType)
				throw new Error(
					`${definition.type} ${dataset.year} is on ${dataset.boundaryType}, not ${definition.boundaryType}`,
				);
			const { release, properties } = releaseFor(
				dataset.boundaryType,
				dataset.boundaryYear,
			);
			const releaseKey = `${dataset.boundaryType}/${release.id}`;
			let codeList = codeLists.get(releaseKey);
			if (!codeList) {
				const sidecar = await readJson<{
					features: Record<string, unknown>[];
				}>(join(paths.boundariesDir, properties));
				codeList = releaseCodeList(
					new Set(
						sidecar.features.flatMap((feature) => {
							const code = feature[release.codeKey];
							return typeof code === "string" ? [code] : [];
						}),
					),
				);
				codeLists.set(releaseKey, codeList);
			}
			const values = orderValues(
				codeList,
				(code) => dataset.data[code]?.[field],
			);
			const text = encodeMapValues(values);
			const hash = sha256(text);
			const key = mapValuesKey(definition.type, releaseKey, dataset.year);
			// The hash is in the name so a rebuilt array is a new URL.
			const file = `${key}.${hash.slice(0, 12)}.json`;
			await mkdir(dirname(join(paths.outDir, file)), { recursive: true });
			await writeFile(join(paths.outDir, file), text);
			entries[key] = {
				file,
				field,
				bytes: Buffer.byteLength(text),
				sha256: hash,
				codeList: codeListId(codeList),
				valueCount: values.filter((value) => value !== null).length,
			};
		}
	}

	const manifest: MapValuesManifest = {
		schemaVersion: MAP_VALUES_SCHEMA_VERSION,
		entries: Object.fromEntries(
			Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)),
		),
	};
	await mkdir(paths.outDir, { recursive: true });
	await writeFile(
		join(paths.outDir, "manifest.json"),
		`${JSON.stringify(manifest, null, "\t")}\n`,
	);
	return manifest;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const manifest = await buildMapValues({
		datasetsDir: join(ROOT, "data/build/datasets"),
		boundariesDir: join(ROOT, "public/data/boundaries"),
		outDir: join(ROOT, "public/data/map-values"),
	});
	const entries = Object.values(manifest.entries);
	const bytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
	console.log(`Wrote ${entries.length} map value arrays, ${bytes} bytes`);
}
