import { IdRegistry } from "../ids/idRegistry.ts";
import type { StatisticsParty } from "@uk-data-atlas/atlas-runtime/measures";
import type { StatisticsDataset } from "@uk-data-atlas/atlas-runtime/measures";

export type PartyRow = {
	id: number;
	/** The abbreviation as the publisher prints it, such as `Lab`. */
	code: string;
	/** The key the atlas's payloads use, such as `LAB`. */
	key: string;
	/** Known from the dataset's declaration, else the code. */
	name: string;
	colour: string | null;
};

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The parties the datasets' contests mention, one row each. A publisher's
 * abbreviation (`first_party`, `second_party`) and the key a winner is
 * declared by are the same party when the key is the abbreviation in upper
 * case, which is how the compiler derives it. A winner with no abbreviation
 * is stored under its key.
 */
export function collectParties(
	datasets: readonly StatisticsDataset[],
	ids: IdRegistry = new IdRegistry("party", { first: 1, fields: 1 }),
) {
	const known = new Map<string, StatisticsParty>();
	for (const dataset of datasets)
		for (const party of dataset.parties ?? []) {
			const other = known.get(party.key);
			if (other && JSON.stringify(other) !== JSON.stringify(party))
				throw new Error(`Conflicting party ${party.key}`);
			known.set(party.key, party);
		}
	const codes = new Set<string>();
	const winners = new Set<string>();
	for (const dataset of datasets)
		for (const election of dataset.elections?.() ?? [])
			for (const { contest } of election.contests) {
				for (const code of [
					contest?.first_party,
					contest?.second_party,
				])
					if (code) codes.add(code);
				if (contest?.winner) winners.add(contest.winner);
			}
	const keyed = new Map<string, string>();
	for (const code of [...codes].sort(byText)) {
		const key = code.toUpperCase();
		const other = keyed.get(key);
		if (other !== undefined)
			throw new Error(
				`Party codes ${other} and ${code} share key ${key}`,
			);
		keyed.set(key, code);
	}
	for (const key of [...winners].sort(byText))
		if (!keyed.has(key)) keyed.set(key, key);
	const rows: PartyRow[] = [...keyed]
		.map(([key, code]) => ({
			code,
			key,
			name: known.get(key)?.name ?? code,
			colour: known.get(key)?.colour ?? null,
		}))
		.sort((a, b) => byText(a.code, b.code))
		// Sorted so that parties new to the registry are numbered the same way
		// each time; the ones it knows keep their ids whatever they sort to.
		.map((party) => ({ id: ids.assign(party.code), ...party }));
	const byCode = new Map(rows.map((row) => [row.code, row.id]));
	const byKey = new Map(rows.map((row) => [row.key, row.id]));
	const need = (ids: Map<string, number>, value: string, kind: string) => {
		const id = ids.get(value);
		if (id === undefined) throw new Error(`Unknown party ${kind} ${value}`);
		return id;
	};
	return {
		rows,
		/** The party a publisher's abbreviation names. */
		idOfCode: (code: string) => need(byCode, code, "code"),
		/** The party a winner is declared by. */
		idOfKey: (key: string) => need(byKey, key, "key"),
	};
}
