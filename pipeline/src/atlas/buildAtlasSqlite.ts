import { type StatisticsInput } from "@uk-data-atlas/measures";
import { statisticsTables } from "../storage/index.ts";
import { declaredStatistics } from "@uk-data-atlas/measures";
import { fuelPovertyStatistics } from "@uk-data-atlas/measures";
import {
	STATISTICS_DATASETS,
	UNSTORED_DATASETS,
} from "@uk-data-atlas/measures";
import { publishAtlasCacheSteps } from "../storage/index.ts";
import { servedFromRows } from "@uk-data-atlas/catalogue/node";
import {
	CACHE_STAGES,
	datasetPayloadStep,
	discardAtlasCacheWork,
	removeStageStamps,
} from "../storage/index.ts";
import { writeSqliteIndex, writeSqliteTables } from "../storage/index.ts";
import {
	type LocationProjectionInventory,
	type LocationProjectionArtifact,
	type LocationParentProjectionArtifact,
} from "@uk-data-atlas/places";
import { locationProjectionTables } from "../storage/index.ts";
import { readStoredText } from "@uk-data-atlas/artifacts";
import { namedLocationTables } from "../storage/index.ts";
import { crosswalkTables } from "../storage/index.ts";
import { DATASETS_VIEW } from "../storage/deprecatedViews.ts";
import { AREA_GEOGRAPHY_MISMATCH, areaTables } from "../storage/index.ts";
import { DatabaseSync } from "node:sqlite";
import { loadIdRegistries } from "../ids/idRegistries.ts";
import { verifyStableIds } from "../ids/databaseKeys.ts";
import { censusSmallAreaStatistics } from "../statistics/censusSmallAreaStatistics.ts";
import {
	CENSUS_SMALL_AREA_TABLES,
	type CensusTable,
} from "../catalog/censusSmallArea.ts";
import { sha256Hex } from "../lib/hash.ts";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	renameSync,
	rmSync,
	symlinkSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
	artifactDirectory,
	closeAllReadOnlyDatabases,
	packText,
} from "@uk-data-atlas/atlas-db";
import { electionWinnerStatistics } from "../statistics/electionWinnerStatistics.ts";

/** Whether an earlier database holds ids that a rebuild could renumber. */
const hasStoredIds = (path: string) => {
	if (!existsSync(path)) return false;
	let database: DatabaseSync | undefined;
	try {
		database = new DatabaseSync(path, { readOnly: true });
		return (
			database
				.prepare("SELECT EXISTS (SELECT 1 FROM area_version) AS found")
				.get()?.found === 1
		);
	} catch {
		// Not a database this build made, so there are no ids to keep.
		return false;
	} finally {
		database?.close();
	}
};

const declared = new Map(
	STATISTICS_DATASETS.map((config) => [config.type, config]),
);

/** Every compiled dataset as statistics rows, read lazily one at a time. */
const statisticsInputs = (
	directory: string,
	entries: readonly {
		type: string;
		output: string;
		source: unknown;
		fingerprint: string;
	}[],
	unstored: Readonly<Record<string, string>>,
): StatisticsInput[] =>
	entries.flatMap((entry): StatisticsInput[] => {
		const read = () =>
			readFileSync(
				join(directory, `datasets/${entry.output}.json`),
				"utf8",
			);
		if (entry.type === "fuelPoverty")
			return [fuelPovertyStatistics(read(), entry)];
		const config = declared.get(entry.type);
		if (config) {
			const statistics = declaredStatistics(config, read, entry);
			if (
				entry.type === "generalElection" ||
				entry.type === "localElection"
			)
				return [
					(areas) =>
						electionWinnerStatistics(
							statistics(areas),
							areas,
							config,
							join(directory, `datasets/${entry.output}.json`),
						),
				];
			return [statistics];
		}
		if (entry.type in unstored) return [];
		throw new Error(
			`Dataset ${entry.type} has no statistics configuration; add one or list it in UNSTORED_DATASETS.`,
		);
	});

/**
 * Build the shared atlas database. `unstored` adds types kept as payloads
 * to `UNSTORED_DATASETS`, so tests can cover a type no real dataset is.
 * `censusTables` are the census small-area tables stored, read from
 * `data/source`; a fixture without those files stores none.
 */
export const buildAtlasSqlite = (
	repositoryRoot: string,
	{
		unstored = {},
		censusTables = CENSUS_SMALL_AREA_TABLES,
	}: {
		unstored?: Readonly<Record<string, string>>;
		censusTables?: readonly CensusTable[];
	} = {},
) => {
	const directory = join(repositoryRoot, "data/build");
	mkdirSync(directory, { recursive: true });
	// The cache is extended below, so what the later stages added to it is
	// no longer known to be there. Their stamps go, and they rebuild. So does
	// any working copy, which was started from the cache as it was.
	removeStageStamps(repositoryRoot, CACHE_STAGES);
	discardAtlasCacheWork(repositoryRoot);
	const path = join(directory, "atlas-base.sqlite");
	// Every id is the one its natural key was first given, from the committed
	// registries in pipeline/ids. A build only adds keys it has not met.
	const ids = loadIdRegistries(repositoryRoot);
	if (ids.empty && hasStoredIds(path))
		throw new Error(
			"There is an atlas database but no id registry, so a rebuild would renumber it. Restore pipeline/ids, or seed it from the database with `pnpm ids seed`.",
		);
	const payload = readFileSync(
		join(artifactDirectory(repositoryRoot), "terrain-catalogue.json"),
		"utf8",
	);
	const manifestPayload = readFileSync(
		join(directory, "datasets/dataset-manifest.json"),
		"utf8",
	);
	const manifest = JSON.parse(manifestPayload) as {
		datasets: {
			type: string;
			output: string;
			source: unknown;
			contract: unknown;
			summary: unknown;
			fingerprint: string;
			compiled: { sha256: string; bytes: number };
		}[];
	};
	const publicDirectory = artifactDirectory(repositoryRoot);
	const projectionDirectory = join(directory, "location-projections");
	const projectionPayload = readFileSync(
		join(projectionDirectory, "location-projection-inventory.json"),
		"utf8",
	);
	const projectionInventory: LocationProjectionInventory =
		JSON.parse(projectionPayload);
	if (
		projectionInventory.schemaVersion !== 1 ||
		!Array.isArray(projectionInventory.shards) ||
		!Array.isArray(projectionInventory.parentShards)
	)
		throw new Error(
			"Invalid location projection inventory before SQLite build.",
		);
	const readProjectionArtifact = (
		shard: LocationProjectionInventory["shards"][number],
	) => {
		const text = readStoredText(join(projectionDirectory, shard.artifact));
		const artifact:
			LocationProjectionArtifact | LocationParentProjectionArtifact =
			JSON.parse(text);
		if (
			artifact.schemaVersion !== 1 ||
			artifact.crosswalkId !== shard.crosswalkId ||
			artifact.contentHash !== shard.contentHash ||
			artifact.namedLocationInventoryHash !==
				projectionInventory.namedLocationInventoryHash ||
			artifact.crosswalkInventoryHash !==
				projectionInventory.crosswalkInventoryHash
		)
			throw new Error(
				`Location projection ${shard.artifact} does not match its inventory.`,
			);
		return artifact;
	};
	const artifacts = projectionInventory.shards.map((shard) => {
		const artifact = readProjectionArtifact(shard);
		if (
			!("projections" in artifact) ||
			!Array.isArray(artifact.projections) ||
			artifact.projections.length !== shard.recordCount
		)
			throw new Error(`Invalid member projections in ${shard.artifact}`);
		return artifact;
	});
	const parentArtifacts = projectionInventory.parentShards.map((shard) => {
		const artifact = readProjectionArtifact(shard);
		if (
			!("parentProjections" in artifact) ||
			!Array.isArray(artifact.parentProjections) ||
			artifact.parentProjections.length !== shard.recordCount
		)
			throw new Error(`Invalid parent projections in ${shard.artifact}`);
		return artifact;
	});
	/** Payloads are stored as compressed blobs. */
	function* payloads() {
		for (const [id, text] of storedPayloads()) yield [id, packText(text)];
	}
	function* storedPayloads() {
		yield ["terrain-catalogue", payload] as const;
		yield ["dataset-manifest", manifestPayload] as const;
		for (const entry of manifest.datasets) {
			const content = readFileSync(
				join(directory, "datasets", `${entry.output}.json`),
				"utf8",
			);
			if (
				Buffer.byteLength(content) !== entry.compiled.bytes ||
				sha256Hex(content) !== entry.compiled.sha256
			)
				throw new Error(
					`Compiled dataset ${entry.output} does not match its manifest`,
				);
			// Datasets served from rows are rebuilt into the cache instead.
			if (!servedFromRows(entry.type))
				yield [`dataset:${entry.output}`, content] as const;
		}
	}
	writeSqliteIndex(
		path,
		{ schemaVersion: "3" },
		{
			...areaTables(artifactDirectory(repositoryRoot), ids),
			...crosswalkTables(artifactDirectory(repositoryRoot), ids),
			...namedLocationTables(artifactDirectory(repositoryRoot)),
			payloads: {
				columns: ["id TEXT NOT NULL", "payload BLOB NOT NULL"],
				key: ["id"],
				rows: payloads(),
			},
			dataset_catalogue: {
				views: { datasets: DATASETS_VIEW },
				columns: [
					"type TEXT NOT NULL",
					"output TEXT NOT NULL UNIQUE",
					"source TEXT NOT NULL",
					"contract TEXT NOT NULL",
					"summary TEXT NOT NULL",
					"fingerprint TEXT NOT NULL",
					"sha256 TEXT NOT NULL",
					"bytes INTEGER NOT NULL",
					"payload_id TEXT REFERENCES payloads(id)",
				],
				key: ["type"],
				rows: manifest.datasets.map((entry) => [
					entry.type,
					entry.output,
					JSON.stringify(entry.source),
					JSON.stringify(entry.contract),
					JSON.stringify(entry.summary),
					entry.fingerprint,
					entry.compiled.sha256,
					entry.compiled.bytes,
					servedFromRows(entry.type)
						? null
						: `dataset:${entry.output}`,
				]),
			},
			...statisticsTables(
				[
					...statisticsInputs(directory, manifest.datasets, {
						...UNSTORED_DATASETS,
						...unstored,
					}),
					// After the declared datasets, whose measures and members
					// the census tables share.
					...censusSmallAreaStatistics(repositoryRoot, censusTables),
				],
				ids,
			),
		},
	);
	const written = new DatabaseSync(path, { readOnly: true });
	try {
		if (Number(written.prepare(AREA_GEOGRAPHY_MISMATCH).get()?.n) !== 0)
			throw new Error("Area versions on another geography's release");
		verifyStableIds(written, ids);
	} finally {
		written.close();
	}
	ids.save();
	const cacheRoot = mkdtempSync(join(directory, ".atlas-base-cache-"));
	const cacheDirectory = join(cacheRoot, "data/build");
	try {
		mkdirSync(cacheDirectory, { recursive: true });
		symlinkSync(resolve(path), join(cacheDirectory, "atlas.sqlite"));
		const cachePath = join(directory, "atlas-cache.sqlite");
		const componentCache = join(cacheDirectory, "atlas-cache.sqlite");
		if (existsSync(cachePath))
			symlinkSync(resolve(cachePath), componentCache);
		// One copy of the published cache takes both components. Later stages
		// add to it in the build's working copy, which is vacuumed once.
		publishAtlasCacheSteps(
			cacheRoot,
			[
				{
					component: "projections",
					write: (database) => {
						const tables = locationProjectionTables({
							artifacts,
							parentArtifacts,
						});
						for (const name of Object.keys(tables))
							database.exec(`DROP TABLE IF EXISTS ${name}`);
						writeSqliteTables(database, tables);
						database
							.prepare(
								"INSERT OR REPLACE INTO payloads VALUES (?, ?)",
							)
							.run(
								"location-projection-inventory",
								JSON.stringify(projectionInventory),
							);
					},
				},
				datasetPayloadStep(cacheRoot),
			],
			{ defer: false, vacuum: false },
		);
		// Nothing in this process may hold the files about to be replaced or removed.
		closeAllReadOnlyDatabases();
		renameSync(componentCache, cachePath);
	} finally {
		closeAllReadOnlyDatabases();
		rmSync(cacheRoot, { recursive: true, force: true });
	}

	rmSync(join(publicDirectory, "location-projections.sqlite"), {
		force: true,
	});
	return path;
};
