import { releaseDate } from "./releases";
import type { AreaHistory, BulkLookup, Crosswalk, ReleaseRef } from "./types";

export interface Successor {
	code: string;
	name: string;
}

const FORWARD = new Set(["successor", "equivalent-to"]);

const releaseOfId = (id: string) => id.split("/")[1] ?? "";

/**
 * The areas in `target` that a retired code became, read from its published
 * history. The API's lineage walks both ways, so it also reaches the other
 * areas a successor was formed from. Following only successor and
 * same-extent links that move forward in time keeps the answer to what this
 * one code became.
 */
export function successorsIn(
	history: AreaHistory,
	target: ReleaseRef,
): Successor[] {
	const reached = new Set([history.id]);
	const found = new Map<string, Successor>();
	const entries = [...history.lineage].sort((a, b) => a.depth - b.depth);

	let grew = true;
	while (grew) {
		grew = false;
		for (const entry of entries) {
			const { counterpart } = entry;
			if (reached.has(counterpart.id)) continue;
			if (!reached.has(entry.from) || !FORWARD.has(entry.relation))
				continue;
			const from = releaseDate(releaseOfId(entry.from));
			const to = releaseDate(counterpart.boundaryRelease);
			if (to < from || (to === from && entry.relation !== "successor"))
				continue;
			reached.add(counterpart.id);
			grew = true;
			if (
				counterpart.geography === target.geography &&
				counterpart.boundaryRelease === target.boundaryRelease
			)
				found.set(counterpart.code, {
					code: counterpart.code,
					name: counterpart.labels?.[0] ?? counterpart.code,
				});
		}
	}
	return [...found.values()];
}

/** Where one release's retired codes can be read in bulk, from a crosswalk. */
export interface SuccessorTable {
	/** The lookup's CSV, from the `href` its manifest gives. */
	href: string;
	bytes: number;
}

/**
 * An official lookup from `from` to `to` within one geography, such as the
 * LSOA 2011 to 2021 lookup. One download then answers every code at once,
 * where history is one request per code. Derived crosswalks are left out:
 * the published history is the authority on what a code became.
 */
export function successorTable(
	from: ReleaseRef,
	to: ReleaseRef,
	crosswalks: Crosswalk[],
	lookups: BulkLookup[],
): SuccessorTable | null {
	const crosswalk = crosswalks.find(
		(each) =>
			each.method === "official-lookup" &&
			each.from.geography === from.geography &&
			each.to.geography === to.geography &&
			each.from.boundaryRelease === from.boundaryRelease &&
			each.to.boundaryRelease === to.boundaryRelease,
	);
	if (!crosswalk) return null;
	const csv = lookups.find(
		(lookup) => lookup.source.artifact === crosswalk.artifact,
	)?.formats.csv;
	return csv ? { href: csv.href, bytes: csv.bytes } : null;
}
