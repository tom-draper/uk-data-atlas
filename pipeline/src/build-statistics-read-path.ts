import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
	isMeasureTable,
	observationArtifactName,
	totalMember,
	type DataCatalog,
} from "@uk-data-atlas/measures";
import {
	SERVED_LOCAL_ELECTION_WARD_CODES,
	SERVED_WARD_CODES_UNTIL,
} from "@uk-data-atlas/datasets/data/election/local-election/servedWardCodes";
import {
	HOUSE_PRICE_SERVED_WARD_CODES,
	SALFORD_WARD_CODE_REMAP,
} from "@uk-data-atlas/datasets/data/house-price/wardCodes";
import { readMeasureDimensionsConfig } from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	artifactRoot,
	apiRootOf,
	statisticsReadPathPath,
	buildDirectory,
	readObservationText,
	rebuildStatisticsObservationText,
	type StatisticsReadPath,
	type StatisticsSelector,
	type StatisticsTableSelector,
} from "@uk-data-atlas/atlas-runtime/storage";

/**
 * Decide, artifact by artifact, whether the API reads observations from the
 * statistics tables or the observation tables, and write the decision to
 * `data/build/statistics-read-path.json`.
 *
 * An artifact moves only when the statistics rows rebuild it byte for byte,
 * so every number, status, interval, period and area is unchanged. Any other
 * artifact stays where it is, and the reason says what differs, so that a
 * difference is reported rather than hidden.
 */
const apiRoot = apiRootOf(
	resolve(dirname(fileURLToPath(import.meta.url)), "../.."),
);
const repositoryRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const databasePath = join(buildDirectory(repositoryRoot), "atlas-base.sqlite");
const observationsPath = join(
	buildDirectory(repositoryRoot),
	"observations.sqlite",
);
const catalog = JSON.parse(
	readFileSync(join(artifactRoot(apiRoot), "data-catalog.json"), "utf8"),
) as DataCatalog;
const { config, vocabulary } = readMeasureDimensionsConfig(apiRoot);
const database = new DatabaseSync(databasePath, { readOnly: true });

/** The dimensions each statistics series of a dataset and measure carries. */
const seriesDimensions = (
	datasetId: string,
	measure: string,
	geography: string,
) =>
	database
		.prepare(
			"SELECT s.id, group_concat(d.slug) AS dimensions FROM series s JOIN dataset ds ON ds.id = s.dataset_id JOIN measure m ON m.id = s.measure_id JOIN area_releases r ON r.position = s.release_id LEFT JOIN series_member sm ON sm.series_id = s.id LEFT JOIN dimension d ON d.id = sm.dimension_id WHERE ds.slug = ? AND m.slug = ? AND r.geography = ? GROUP BY s.id",
		)
		.all(datasetId, measure, geography)
		.map((row) =>
			row.dimensions === null ? [] : String(row.dimensions).split(","),
		);

/**
 * Measures the API serves that the statistics tables hold as parts of
 * another: a party's vote share is its votes over the valid votes, a local
 * election's effective votes are every party's votes summed, and population
 * density is population over land area.
 */
const COMPUTED: Record<
	string,
	Pick<StatisticsSelector, "measure" | "ratio" | "plus" | "status">
> = {
	// Residents per square kilometre of land, from the 2024 land area.
	"population-density": {
		measure: "population",
		ratio: {
			datasetId: "land-area",
			measure: "area",
			dimensions: { surface: "land" },
			period: "2024",
			denominatorDivisor: 100,
			scale: 1,
			scaleQuotient: true,
		},
		status: "derived",
	},
	"party-vote-share": {
		measure: "party-votes",
		ratio: { measure: "valid-votes", scale: 100 },
	},
	"effective-votes": { measure: "party-votes" },
};

/**
 * Measures a dataset derives from its other measures rather than storing:
 * a general election's turnout is its valid votes and rejected ballots as a
 * percentage of the electorate.
 */
const DERIVED: Record<
	string,
	Record<
		string,
		Pick<StatisticsSelector, "measure" | "ratio" | "plus" | "status">
	>
> = {
	"general-election": {
		turnout: {
			measure: "valid-votes",
			plus: ["rejected-ballots"],
			ratio: { measure: "electorate", scale: 100, scaleQuotient: true },
		},
	},
};

/**
 * Measures published with the half-width of their confidence interval as a
 * measure of its own, rounded as the publisher gives the value.
 */
const HALF_WIDTHS: Record<string, StatisticsSelector["halfWidth"]> = {
	"unemployment-rate": { measure: "unemployment-rate-interval", digits: 1 },
	"unemployed-people": { measure: "unemployed-people-interval", digits: 1 },
};

/** Measures where an area with no row in a contest polled nothing. */
const ABSENT_AS_ZERO = new Set(["party-votes"]);

/**
 * The codes a dataset serves in place of those its rows are stored under,
 * as the observation artifacts were built.
 */
const servedCodesFor = (
	datasetId: string,
	boundaryYear: number,
): StatisticsSelector["servedCodes"] => {
	if (
		datasetId === "local-election" &&
		boundaryYear < SERVED_WARD_CODES_UNTIL
	)
		return Object.fromEntries(
			[...SERVED_LOCAL_ELECTION_WARD_CODES].map(([source, served]) => [
				source,
				{ areaCode: served, sourceAreaCode: source },
			]),
		);
	if (datasetId === "house-price")
		return Object.fromEntries([
			...Object.entries(SALFORD_WARD_CODE_REMAP).map(
				([published, compiled]) => [compiled, { areaCode: published }],
			),
			...[...HOUSE_PRICE_SERVED_WARD_CODES].map(([source, served]) => [
				source,
				{ areaCode: served, sourceAreaCode: source },
			]),
		]);
	return undefined;
};

/**
 * The series an artifact would be read from. A dimension the mapping leaves
 * open is fixed at its total where it has one, and summed over otherwise.
 */
const selectorFor = (
	measureId: string,
	datasetId: string,
	geography: string,
	boundaryYear: number,
): StatisticsSelector | string => {
	const mapping = config.ids[measureId]!;
	if (mapping.measure === "winning-party") {
		// The winner is stored as text on each contest, not as a series.
		const servedCodes = servedCodesFor(datasetId, boundaryYear);
		return {
			datasetId,
			measure: mapping.measure,
			dimensions: {},
			geography,
			contest: "winner",
			...(servedCodes ? { servedCodes } : {}),
		};
	}
	const computed =
		DERIVED[datasetId]?.[mapping.measure] ?? COMPUTED[mapping.measure];
	const measure = computed?.measure ?? mapping.measure;
	if (!(measure in vocabulary.measures))
		return `${mapping.measure} is not in the statistics tables.`;
	for (const dimension of Object.keys(mapping.dimensions ?? {}))
		if (!(dimension in vocabulary.dimensions))
			return `The ${dimension} dimension is not in the statistics tables.`;
	const held = seriesDimensions(datasetId, measure, geography);
	if (held.length === 0)
		return `The statistics tables hold no ${measure} series from ${datasetId} on ${geography}.`;
	const dimensions = { ...(mapping.dimensions ?? {}) };
	const sum: string[] = [];
	for (const dimension of new Set(held.flat())) {
		if (dimension in dimensions) continue;
		const total = totalMember(vocabulary.dimensions[dimension]!.members);
		if (total) dimensions[dimension] = total;
		else sum.push(dimension);
	}
	const servedCodes = servedCodesFor(datasetId, boundaryYear);
	return {
		datasetId,
		measure,
		dimensions,
		geography,
		...(sum.length > 0 ? { sum: sum.sort() } : {}),
		...(ABSENT_AS_ZERO.has(measure) && sum.length === 0
			? { absentAsZero: true as const }
			: {}),
		...(servedCodes ? { servedCodes } : {}),
		...(HALF_WIDTHS[measure] ? { halfWidth: HALF_WIDTHS[measure] } : {}),
		...(computed?.plus ? { plus: computed.plus } : {}),
		...(computed?.ratio ? { ratio: computed.ratio } : {}),
		...(computed?.status ? { status: computed.status } : {}),
	};
};

/** The releases of a geography published in a code year. */
const releasesIn = (geography: string, year: number) =>
	database
		.prepare(
			"SELECT id FROM area_releases WHERE geography = ? AND id LIKE ? ORDER BY id",
		)
		.all(geography, `${year}-%`)
		.map((row) => String(row.id));

type StoredRecord = {
	areaCode: string;
	value?: number | null;
	status?: string;
	category?: string;
	sourceAreaCode?: string;
	confidenceInterval?: unknown;
};
type Artifact = { periods: Array<{ period: string; records: StoredRecord[] }> };

/** What differs between the stored artifact and its rebuild, in a sentence. */
const difference = (stored: Artifact, rebuilt: Artifact) => {
	const index = (artifact: Artifact) =>
		new Map(
			artifact.periods.flatMap(({ period, records }) =>
				records.map(
					(record) =>
						[`${period} ${record.areaCode}`, record] as const,
				),
			),
		);
	const before = index(stored);
	const after = index(rebuilt);
	let missing = 0;
	let missingZero = 0;
	let extra = 0;
	let values = 0;
	let other = 0;
	let example: string | undefined;
	for (const [key, record] of before) {
		const held = after.get(key);
		if (!held) {
			missing++;
			if (record.value === 0) missingZero++;
			example ??= `${key} is missing`;
		} else if (record.value !== held.value) {
			values++;
			example ??= `${key} is ${String(record.value)}, rebuilt as ${String(held.value)}`;
		} else if (JSON.stringify(record) !== JSON.stringify(held)) {
			other++;
			example ??= `${key} is ${JSON.stringify(record)}, rebuilt as ${JSON.stringify(held)}`;
		}
	}
	for (const key of after.keys()) if (!before.has(key)) extra++;
	const parts = [
		missing &&
			`${missing} of ${before.size} records are missing${missingZero ? ` (${missingZero} of them zero)` : ""}`,
		values && `${values} values differ`,
		other && `${other} records differ in status, interval or source code`,
		extra && `${extra} records are extra`,
	].filter(Boolean);
	return parts.length
		? `The statistics rows do not rebuild it: ${parts.join(", ")}. For example, ${example}.`
		: "The statistics rows rebuild the same records in a different layout.";
};

const plan: StatisticsReadPath = {
	schemaVersion: 1,
	statistics: {},
	observations: {},
};
for (const measure of catalog.measures)
	for (const source of measure.sources) {
		const name = observationArtifactName(measure.id, source);
		const storedText = readObservationText(observationsPath, name);
		const stored = JSON.parse(storedText) as Artifact;
		if (isMeasureTable(stored)) {
			// One table serves several measures; plan it once.
			if (name in plan.statistics || name in plan.observations) continue;
			const table: StatisticsTableSelector = {
				kind: "measure-table",
				id: stored.id,
				datasetId: stored.datasetId,
				geography: stored.sourceGeography.type,
				boundaryYear: stored.sourceGeography.boundaryYear,
				period: stored.period,
				measures: stored.measures,
				columns: stored.measures.map((id) => ({
					measure: config.ids[id]!.measure,
					dimensions: config.ids[id]!.dimensions ?? {},
				})),
			};
			try {
				if (
					rebuildStatisticsObservationText(database, table, {
						measureId: measure.id,
						sourceGeography: source.sourceGeography,
						periods: source.periods,
					}) === storedText
				)
					plan.statistics[name] = table;
				else
					plan.observations[name] =
						"The statistics rows do not rebuild this census table byte for byte.";
			} catch (error) {
				plan.observations[name] = (error as Error).message;
			}
			continue;
		}
		const selector = selectorFor(
			measure.id,
			source.datasetId,
			source.sourceGeography.type,
			source.sourceGeography.boundaryYear,
		);
		if (typeof selector === "string") {
			plan.observations[name] = selector;
			continue;
		}
		const rebuild = (candidate: StatisticsSelector) =>
			rebuildStatisticsObservationText(database, candidate, {
				measureId: measure.id,
				sourceGeography: source.sourceGeography,
				periods: source.periods,
			});
		let rebuiltText: string;
		try {
			rebuiltText = rebuild(selector);
		} catch (error) {
			plan.observations[name] = (error as Error).message;
			continue;
		}
		// A census source on a later code year lists only the codes that
		// year's releases still use.
		const narrowed = {
			...selector,
			areasIn: releasesIn(
				source.sourceGeography.type,
				source.sourceGeography.boundaryYear,
			),
		};
		if (rebuiltText !== storedText && narrowed.areasIn.length > 0) {
			const narrowedText = rebuild(narrowed);
			if (narrowedText === storedText) {
				plan.statistics[name] = narrowed;
				continue;
			}
		}
		if (rebuiltText === storedText) plan.statistics[name] = selector;
		else
			plan.observations[name] = difference(
				stored,
				JSON.parse(rebuiltText) as Artifact,
			);
	}
database.close();

const sorted = <T>(entries: { [key: string]: T }) =>
	Object.fromEntries(
		Object.entries(entries).sort(([left], [right]) =>
			left.localeCompare(right),
		),
	);
const file = statisticsReadPathPath(apiRoot);
writeFileSync(
	file,
	`${JSON.stringify(
		{
			schemaVersion: 1,
			statistics: sorted(plan.statistics),
			observations: sorted(plan.observations),
		},
		null,
		"\t",
	)}\n`,
);
console.log(
	`${Object.keys(plan.statistics).length} artifacts read from statistics rows, ${Object.keys(plan.observations).length} from observation tables. Wrote ${file}`,
);
