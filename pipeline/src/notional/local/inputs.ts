import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { readPlacement } from "../../crosswalk-weights/placements.ts";
import { crosswalkWeightsDirectory } from "../../crosswalk-weights/paths.ts";
import {
	readStoredAtoms,
	weightAtomsDirectory,
} from "../../crosswalk-weights/storedAtoms.ts";
import type { Placement } from "../../crosswalk-weights/weigh.ts";
import { readCovariates } from "../census.ts";
import {
	CENSUS_DATASETS,
	group,
	type LocalSource,
	LSOA,
	party,
	shareAlikeLocal,
	values,
	type Votes,
} from "../inputs.ts";

/**
 * What the local notionals read: the weight atoms, ward local election results
 * by polling day, the ward and council releases they lie in, and census 2021
 * counts by LSOA for adults and the covariates. Read from a built checkout's
 * `atlas-base.sqlite`, like the general election notional (`../inputs.ts`).
 */

export type Election = LocalSource;

export type LocalInputs = {
	atoms: number;
	/** Adults per atom: residents times their LSOA's adult share. */
	adults: Float64Array;
	censusKeys: string[];
	elections: Election[];
	/** The latest ward release, a target with no results yet. */
	latest: string;
	/** The atoms' placement in a ward release, read once when first asked. */
	wardsOf: (release: string) => Placement;
	/** Council releases by name, to group wards into councils. */
	councils: Map<string, Placement>;
	names: Map<string, Map<string, string>>;
};

/**
 * A day's results can sit on more than one release (a handful of wards
 * published on a neighbouring one). Only the release holding most of the
 * day's wards is read, so each election has one set of old wards.
 */
const dominant = (sources: Election[]) =>
	sources.sort((a, b) => b.wards.size - a.wards.size)[0]!;

export const readLocalInputs = (root: string): LocalInputs => {
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
		{ readOnly: true },
	);
	try {
		const byDay = new Map<string, Map<string, Election>>();
		for (const row of values(
			database,
			"local-election/party-votes/ward:%",
		)) {
			const release = row.key.split("/")[2]!.slice("ward:".length);
			const day = group(
				byDay,
				row.period,
				() => new Map<string, Election>(),
			);
			const election = group<Election>(day, release, () => ({
				period: row.period,
				release,
				wards: new Map(),
				keys: [],
				shareAlike: shareAlikeLocal(row.period),
			}));
			group<Votes>(election.wards, row.code, () => ({}))[party(row.key)] =
				row.value;
			if (!election.keys.includes(row.key)) election.keys.push(row.key);
		}
		const elections = [...byDay.values()]
			.map((day) => dominant([...day.values()]))
			.sort((a, b) => a.period.localeCompare(b.period));
		const releases = (geography: string) =>
			(
				database
					.prepare(
						"SELECT release FROM area_releases WHERE geography = ? ORDER BY release",
					)
					.all(geography) as { release: string }[]
			).map((row) => row.release);
		const wardReleases = releases("ward");
		const latest = wardReleases.at(-1)!;
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
		const lsoa = place("lsoa", LSOA);
		const covariates = readCovariates({ lsoa, census });
		const population = atoms.measures.population;
		let shares = 0;
		let counted = 0;
		for (const share of covariates.adultShare)
			if (Number.isFinite(share)) {
				shares += share;
				counted++;
			}
		const meanShare = shares / counted;
		const adults = new Float64Array(atoms.count);
		for (let i = 0; i < atoms.count; i++) {
			const l = lsoa.area[i]!;
			const share = l >= 0 ? covariates.adultShare[l]! : Number.NaN;
			adults[i] =
				(population[i]! || 0) *
				(Number.isFinite(share) ? share : meanShare);
		}
		const targets = [
			...new Set([...elections.map((e) => e.release), latest]),
		];
		const councils = new Map(
			releases("localAuthority").flatMap((release) => {
				const found = readPlacement(
					directories,
					"localAuthority",
					release,
				);
				return found ? [[release, found] as const] : [];
			}),
		);
		const wards = new Map<string, Placement>();
		const names = new Map<string, Map<string, string>>();
		const nameRows = database.prepare(
			`SELECT a.code AS code, v.name AS name FROM area_version v
			JOIN area a ON a.id = v.area_id JOIN area_releases r ON r.id = v.release_id
			WHERE r.geography = 'ward' AND r.release = ?`,
		);
		for (const release of targets)
			names.set(
				release,
				new Map(
					(
						nameRows.all(release) as {
							code: string;
							name: string;
						}[]
					).map((row) => [row.code, row.name]),
				),
			);
		return {
			atoms: atoms.count,
			adults,
			censusKeys: [...censusKeys].sort(),
			elections,
			latest,
			wardsOf: (release) =>
				group(wards, release, () => place("ward", release)),
			councils,
			names,
		};
	} finally {
		database.close();
	}
};
