import { releaseDate } from "./releases";
import type { AreaHistory, ReleaseRef } from "./types";

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
