import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DATASET_SPLIT_MODULES } from "@uk-data-atlas/datasets/registry";
import { readPlacement } from "../crosswalk-weights/placements.ts";
import {
	readStoredAtoms,
	weightAtomsDirectory,
} from "../crosswalk-weights/storedAtoms.ts";
import { crosswalkWeightsDirectory } from "../crosswalk-weights/paths.ts";
import type { Placement } from "../crosswalk-weights/weigh.ts";
import { readScottishLocal } from "./scotland.ts";

/**
 * What the notional estimate reads: the weight atoms and where they lie, the
 * 2019 general election by old seat, ward local election results (with the
 * 2017 Scottish council first preferences, see `scotland.ts`), and census 2021
 * counts by LSOA. All of it is read from a built checkout, read only, before
 * `assemble-atlas`: the published series are in `atlas-base.sqlite`.
 */

export type Votes = Record<string, number>;

export type LocalSource = {
	/** Polling day. */
	period: string;
	/** The ward boundary release the results are published on. */
	release: string;
	wards: Map<string, Votes>;
	keys: string[];
	/** Under CC BY-SA, so anything built from it must be too. */
	shareAlike: boolean;
};

export type NotionalInputs = {
	population: Float64Array;
	atoms: number;
	oldSeats: Placement;
	newSeats: Placement;
	lsoa: Placement;
	wards: Map<string, Placement>;
	general: Map<string, Votes>;
	generalKeys: string[];
	local: LocalSource[];
	/** Census 2021 counts by LSOA, per dataset and category. */
	census: Map<string, Map<string, Record<string, number>>>;
	censusKeys: string[];
	names: Map<string, string>;
};

export const OLD_SEATS = "2019-12-uk-bgc";
export const NEW_SEATS = "2024-07-uk-bgc";
export const LSOA = "2021-12-ew-bgc-v5";
export const GENERAL_DAY = "2019-12-12";
/** Local elections after this are too far from 2019 to stand in for it. */
export const LOCAL_LAST = "2023-12-31";
export const CENSUS_DATASETS = [
	"ts007a",
	"ts021",
	"ts037",
	"ts054",
	"ts066",
] as const;

/**
 * Whether local results polled on this day are under a share-alike licence,
 * by the date ranges of the licensed-rows modules that take local elections.
 */
export const isShareAlikeLocal = (period: string) =>
	DATASET_SPLIT_MODULES.some(
		(split) =>
			split.holds === "licensed-rows" &&
			(split.datasets as readonly string[]).includes("local-election") &&
			split.electionDates !== undefined &&
			period >= split.electionDates.from &&
			period <= split.electionDates.to,
	);

type ValueRow = { key: string; code: string; period: string; value: number };

const values = (database: DatabaseSync, keyLike: string, periodLike = "%") =>
	database
		.prepare(
			`SELECT s.key AS key, a.code AS code, p.label AS period, o.value AS value
			FROM observation o JOIN series s ON s.id = o.series_id
			JOIN area_version v ON v.id = o.area_version_id JOIN area a ON a.id = v.area_id
			JOIN period p ON p.id = o.period_id
			WHERE s.method = 'published' AND s.key LIKE ? AND p.label LIKE ? AND o.value IS NOT NULL`,
		)
		.all(keyLike, periodLike) as ValueRow[];

const party = (key: string) => key.slice(key.lastIndexOf("=") + 1);

const group = <T>(map: Map<string, T>, key: string, make: () => T) => {
	let found = map.get(key);
	if (found === undefined) map.set(key, (found = make()));
	return found;
};

export const readNotionalInputs = (root: string): NotionalInputs => {
	const directories = [
		join(weightAtomsDirectory(root), "placements"),
		join(crosswalkWeightsDirectory(root), "placements"),
	];
	const place = (geography: string, release: string) => {
		const found = readPlacement(directories, geography, release);
		if (!found)
			throw new Error(
				`No placement of the atoms in ${geography} ${release}`,
			);
		return found;
	};
	const atoms = readStoredAtoms(root);
	const database = new DatabaseSync(
		join(root, "data/build/atlas-base.sqlite"),
		{
			readOnly: true,
		},
	);
	try {
		const general = new Map<string, Votes>();
		const generalKeys = new Set<string>();
		for (const row of values(
			database,
			`general-election/party-votes/constituency:${OLD_SEATS}/%`,
			GENERAL_DAY,
		)) {
			group<Votes>(general, row.code, () => ({}))[party(row.key)] =
				row.value;
			generalKeys.add(row.key);
		}
		const sources = new Map<string, LocalSource>();
		for (const row of values(
			database,
			"local-election/party-votes/ward:%",
		)) {
			if (row.period > LOCAL_LAST) continue;
			const release = row.key.split("/")[2]!.slice("ward:".length);
			const source = group(sources, `${row.period}|${release}`, () => ({
				period: row.period,
				release,
				wards: new Map(),
				keys: [],
				shareAlike: isShareAlikeLocal(row.period),
			}));
			group<Votes>(source.wards, row.code, () => ({}))[party(row.key)] =
				row.value;
			if (!source.keys.includes(row.key)) source.keys.push(row.key);
		}
		const census = new Map<string, Map<string, Record<string, number>>>();
		const censusKeys = new Set<string>();
		for (const dataset of CENSUS_DATASETS) {
			const byArea = new Map<string, Record<string, number>>();
			for (const row of values(
				database,
				`census-2021-${dataset}/%/lsoa:${LSOA}/%`,
			)) {
				group<Record<string, number>>(byArea, row.code, () => ({}))[
					party(row.key)
				] = row.value;
				censusKeys.add(row.key);
			}
			census.set(dataset, byArea);
		}
		const names = new Map(
			(
				database
					.prepare(
						`SELECT a.code AS code, v.name AS name FROM area_version v
						JOIN area a ON a.id = v.area_id JOIN area_releases r ON r.id = v.release_id
						WHERE r.geography = 'constituency' AND r.release IN (?, ?)`,
					)
					.all(OLD_SEATS, NEW_SEATS) as {
					code: string;
					name: string;
				}[]
			).map((row) => [row.code, row.name]),
		);
		const local = [...sources.values(), readScottishLocal(root)];
		return {
			population: atoms.measures.population,
			atoms: atoms.count,
			oldSeats: place("constituency", OLD_SEATS),
			newSeats: place("constituency", NEW_SEATS),
			lsoa: place("lsoa", LSOA),
			wards: new Map(
				[...new Set(local.map((s) => s.release))].map((release) => [
					release,
					place("ward", release),
				]),
			),
			general,
			generalKeys: [...generalKeys].sort(),
			local,
			census,
			censusKeys: [...censusKeys].sort(),
			names,
		};
	} finally {
		database.close();
	}
};
