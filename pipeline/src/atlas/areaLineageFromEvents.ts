import type { DatabaseSync } from "node:sqlite";
import {
	compileAreaLineage,
	LINEAGE_GEOGRAPHIES,
	type AreaLineage,
	type AtlasVintages,
	type LineageAnswer,
} from "@uk-data-atlas/geography";
import { selectIdentityCrosswalks } from "../storage/areaChangeEvents.ts";

/**
 * Where each area of a geography goes from release to release, read from the
 * change events the assembly wrote (`area_change_event`) and compiled into the
 * compact lineage the website reads. The API serves the events and the
 * relationship routes; the website, which cannot reach the API, is given this
 * file of its own.
 *
 * An event answers for the areas it names. An area of a covered release pair
 * that no event names was unchanged, so it is the same area under the same
 * code. An event with one area on each side keeps the area when it is a
 * rename, a recode, or a redrawing that an extent-continuity crosswalk
 * realigned; every other event leaves no same area, as the retired resolver
 * did not name one. An extent-continuity crosswalk's realigned areas are then
 * applied on top, so a ward the crosswalk lists as realigned still succeeds
 * itself where an official lookup's slivers made the event a split.
 */

/** What one release pair says of an area: its successor, or none. */
type Hop = Map<string, LineageAnswer | null>;

type GeographyEvents = {
	/** Release names that are covered by a pair, each with the codes it holds. */
	codes: Map<string, Set<string>>;
	/** `from>to`, forward from the earlier release. */
	forward: Map<string, Hop>;
	backward: Map<string, Hop>;
	/** Every covered pair, as `from>to` in time order. */
	covered: Set<string>;
};

const pairKey = (from: string, to: string) => `${from}>${to}`;

function readEvents(
	database: DatabaseSync,
	geography: string,
): GeographyEvents {
	const codes = new Map<string, Set<string>>();
	for (const row of database
		.prepare(
			`SELECT r.release, a.code
			FROM area_release r
			JOIN area_version v ON v.release_id = r.id
			JOIN area a ON a.id = v.area_id
			WHERE r.geography = ?`,
		)
		.all(geography))
		(
			codes.get(String(row.release)) ??
			codes.set(String(row.release), new Set()).get(String(row.release))!
		).add(String(row.code));

	const covered = new Set<string>();
	for (const crosswalk of selectIdentityCrosswalks(database))
		if (crosswalk.geography === geography)
			covered.add(pairKey(crosswalk.fromRelease, crosswalk.toRelease));

	const events = new Map<
		number,
		{
			pair: string;
			kind: string;
			realigned: boolean;
			from: string[];
			to: string[];
		}
	>();
	for (const row of database
		.prepare(
			`SELECT e.id, fr.release AS from_release, tr.release AS to_release,
				e.kind, e.realigned, m.side, a.code
			FROM area_change_event e
			JOIN geography g ON g.id = e.geography_id
			JOIN area_release fr ON fr.id = e.from_release_id
			JOIN area_release tr ON tr.id = e.to_release_id
			JOIN area_change_member m ON m.event_id = e.id
			JOIN area_version v ON v.id = m.area_version_id
			JOIN area a ON a.id = v.area_id
			WHERE g.slug = ?
			ORDER BY e.id`,
		)
		.all(geography)) {
		const id = Number(row.id);
		let event = events.get(id);
		if (!event) {
			const pair = pairKey(
				String(row.from_release),
				String(row.to_release),
			);
			covered.add(pair);
			events.set(
				id,
				(event = {
					pair,
					kind: String(row.kind),
					realigned: row.realigned === 1,
					from: [],
					to: [],
				}),
			);
		}
		(row.side === "from" ? event.from : event.to).push(String(row.code));
	}

	const forward = new Map<string, Hop>();
	const backward = new Map<string, Hop>();
	const hop = (map: Map<string, Hop>, pair: string) =>
		map.get(pair) ?? map.set(pair, new Map()).get(pair)!;
	for (const event of events.values()) {
		const [from, to] = event.pair.split(">") as [string, string];
		const kept =
			event.from.length === 1 &&
			event.to.length === 1 &&
			(event.kind === "renamed" ||
				event.kind === "recoded" ||
				(event.kind === "redrawn" && event.realigned));
		for (const code of event.from)
			hop(forward, event.pair).set(
				code,
				kept
					? { code: event.to[0]!, realigned: event.realigned }
					: null,
			);
		for (const code of event.to)
			hop(backward, pairKey(to, from)).set(
				code,
				kept
					? { code: event.from[0]!, realigned: event.realigned }
					: null,
			);
	}
	// The events use one crosswalk per release pair, the official lookup where
	// there is one, so a ward that an extent-continuity crosswalk lists as
	// realigned may sit in a split or redistribution that a lookup's slivers
	// made. The ward still succeeds itself, as the resolver's `successorArea`
	// holds: the realigned successor stands where the event names none, and
	// confirms the one it names.
	for (const row of database
		.prepare(
			`SELECT fr.release AS from_release, tr.release AS to_release, c.validation
			FROM crosswalk c
			JOIN area_release fr ON fr.id = c.from_release_id
			JOIN area_release tr ON tr.id = c.to_release_id
			WHERE c.method = 'extent-continuity' AND c.purpose = 'identity'
				AND fr.geography = ? AND tr.geography = ?
			ORDER BY c.id`,
		)
		.all(geography, geography)) {
		const pair = pairKey(String(row.from_release), String(row.to_release));
		if (!covered.has(pair) || typeof row.validation !== "string") continue;
		const realigned = (
			JSON.parse(row.validation) as {
				continuity?: {
					realigned?: Array<{ code: string; successor: string }>;
				};
			}
		).continuity?.realigned;
		const sources = new Map<string, number>();
		const successors = new Map<string, number>();
		for (const { code, successor } of realigned ?? []) {
			sources.set(code, (sources.get(code) ?? 0) + 1);
			successors.set(successor, (successors.get(successor) ?? 0) + 1);
		}
		const [from, to] = pair.split(">") as [string, string];
		for (const { code, successor } of realigned ?? []) {
			if (sources.get(code) !== 1 || successors.get(successor) !== 1)
				continue;
			const settle = (
				map: Map<string, Hop>,
				at: string,
				area: string,
				other: string,
			) => {
				const held = hop(map, at);
				const now = held.get(area);
				if (now === undefined || now === null || now.code === other)
					held.set(area, { code: other, realigned: true });
			};
			if (codes.get(from)?.has(code) && codes.get(to)?.has(successor)) {
				settle(forward, pair, code, successor);
				settle(backward, pairKey(to, from), successor, code);
			}
		}
	}
	return { codes, forward, backward, covered };
}

/**
 * The successor an area has in another release: the answer of the release pair
 * itself where one is covered, else the answers of the shortest chain of
 * covered pairs between them, taken in either direction.
 */
function successorFrom(events: GeographyEvents) {
	const neighbours = new Map<string, string[]>();
	for (const pair of events.covered) {
		const [from, to] = pair.split(">") as [string, string];
		for (const [a, b] of [
			[from, to],
			[to, from],
		] as const)
			neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
	}
	for (const list of neighbours.values()) list.sort();

	const path = (from: string, to: string): string[] | undefined => {
		const previous = new Map<string, string>([[from, from]]);
		const queue = [from];
		for (let next = 0; next < queue.length; next += 1) {
			const release = queue[next]!;
			if (release === to) break;
			for (const other of neighbours.get(release) ?? [])
				if (!previous.has(other)) {
					previous.set(other, release);
					queue.push(other);
				}
		}
		if (!previous.has(to)) return undefined;
		const chain = [to];
		while (chain[0] !== from) chain.unshift(previous.get(chain[0]!)!);
		return chain;
	};

	const step = (
		code: string,
		from: string,
		to: string,
	): LineageAnswer | null | undefined => {
		// A pair is held forward when `from` is the earlier release, else backward.
		const direct = events.covered.has(pairKey(from, to))
			? events.forward.get(pairKey(from, to))
			: events.backward.get(pairKey(from, to));
		const named = direct?.get(code);
		if (named !== undefined) return named;
		return events.codes.get(to)?.has(code)
			? { code, realigned: false }
			: undefined;
	};

	const cache = new Map<string, string[] | undefined>();
	return (code: string, from: string, to: string) => {
		const key = pairKey(from, to);
		if (!cache.has(key)) cache.set(key, path(from, to));
		const chain = cache.get(key);
		if (!chain) return undefined;
		let current = code;
		let realigned = false;
		for (let index = 1; index < chain.length; index += 1) {
			const answer = step(current, chain[index - 1]!, chain[index]!);
			if (!answer) return undefined;
			current = answer.code;
			realigned ||= answer.realigned;
		}
		return { code: current, realigned };
	};
}

/**
 * The lineage of each geography the atlas carries data between years for,
 * over the releases it draws.
 */
export function compileLineagesFromEvents(
	database: DatabaseSync,
	vintages: AtlasVintages,
): Record<string, AreaLineage> {
	const lineage: Record<string, AreaLineage> = {};
	for (const geography of LINEAGE_GEOGRAPHIES) {
		const events = readEvents(database, geography);
		const successor = successorFrom(events);
		const releases = [
			...new Set(Object.values(vintages[geography])),
		].sort();
		for (const release of releases)
			if (!events.codes.has(release))
				throw new Error(
					`${geography}/${release} is drawn by the atlas but holds no areas in the release.`,
				);
		lineage[geography] = compileAreaLineage(
			geography,
			releases,
			(release) => events.codes.get(release) ?? [],
			(code, from, to) => successor(code, from, to),
		);
	}
	return lineage;
}
