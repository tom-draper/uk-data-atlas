import type { DatabaseSync } from "node:sqlite";
import {
	classifyChanges,
	compareText,
	type AreaChange,
	type ChangeArea,
	type ChangeKind,
	type ChangeLink,
} from "./areaChangeClassifier.ts";

/**
 * `area_change_event`, `area_change_member` and `v_area_change`: what became
 * of each area that changed between two releases of one geography, as dated
 * events. Written at atlas assembly, after the crosswalks and their weights
 * are in, from the identity crosswalks (the ones that link releases of one
 * geography) and, for anything they do not cover, the publishers' predecessor
 * statements in `area_relationship`.
 *
 * Dates are edition dates: the change happened by the later release's edition,
 * not necessarily on that day. The atlas does not hold the ONS Code History
 * Database, which has the legal dates.
 */
const TABLES = `
CREATE TABLE area_change_event (
	id INTEGER,
	geography_id INTEGER NOT NULL REFERENCES geography(id),
	from_release_id INTEGER NOT NULL REFERENCES area_releases(id),
	to_release_id INTEGER NOT NULL REFERENCES area_releases(id),
	kind TEXT NOT NULL CHECK (kind IN ('renamed', 'recoded', 'split', 'merged', 'redistributed', 'ended', 'created')),
	effective_date TEXT NOT NULL,
	date_basis TEXT NOT NULL CHECK (date_basis IN ('edition')),
	source TEXT NOT NULL CHECK (source IN ('crosswalk', 'publisher')),
	crosswalk_id INTEGER REFERENCES crosswalk(id),
	CHECK ((source = 'crosswalk') = (crosswalk_id IS NOT NULL)),
	PRIMARY KEY (id)
) STRICT;
CREATE TABLE area_change_member (
	event_id INTEGER NOT NULL REFERENCES area_change_event(id),
	side TEXT NOT NULL CHECK (side IN ('from', 'to')),
	area_version_id INTEGER NOT NULL REFERENCES area_version(id),
	share REAL,
	PRIMARY KEY (event_id, side, area_version_id)
) WITHOUT ROWID, STRICT;
CREATE INDEX area_change_member_version ON area_change_member (area_version_id);
CREATE INDEX area_change_event_kind ON area_change_event (geography_id, kind, effective_date);
CREATE VIEW v_area_change AS
SELECT e.id AS event_id, g.slug AS geography, e.kind, e.effective_date, e.date_basis, e.source,
	fr.release AS from_release, tr.release AS to_release,
	m.side, a.code, v.name, m.share, m.area_version_id
FROM area_change_event e
JOIN geography g ON g.id = e.geography_id
JOIN area_releases fr ON fr.id = e.from_release_id
JOIN area_releases tr ON tr.id = e.to_release_id
JOIN area_change_member m ON m.event_id = e.id
JOIN area_version v ON v.id = m.area_version_id
JOIN area a ON a.id = v.area_id`;

export type ChangeEvent = {
	geographyId: number;
	geography: string;
	fromReleaseId: number;
	toReleaseId: number;
	fromRelease: string;
	toRelease: string;
	effectiveDate: string;
	source: "crosswalk" | "publisher";
	crosswalkId: number | null;
	change: AreaChange;
};

export type IdentityCrosswalk = {
	id: number;
	method: string;
	geographyId: number;
	geography: string;
	fromReleaseId: number;
	toReleaseId: number;
	fromRelease: string;
	toRelease: string;
	fromEdition: string;
	toEdition: string;
};

const countryOf = (code: string) => code.slice(0, 1);

/**
 * The identity crosswalks that say what changed over time. A crosswalk whose
 * two releases share an edition date links variants of one edition (a filtered
 * copy, a reissue), not a change. Where several crosswalks reach one release
 * from reissues of the same edition, the official lookup is used, else the
 * lowest id.
 */
export function selectIdentityCrosswalks(
	database: DatabaseSync,
): IdentityCrosswalk[] {
	const rows = database
		.prepare(
			`SELECT c.id, c.method, g.id AS geography_id, fr.geography,
				c.from_release_id, c.to_release_id, fr.release AS from_release, tr.release AS to_release,
				fe.edition_from AS from_edition, te.edition_from AS to_edition
			FROM crosswalk c
			JOIN area_releases fr ON fr.id = c.from_release_id
			JOIN area_releases tr ON tr.id = c.to_release_id
			JOIN geography g ON g.slug = fr.geography
			JOIN boundary_release_edition fe ON fe.geography = fr.geography AND fe.release = fr.release
			JOIN boundary_release_edition te ON te.geography = tr.geography AND te.release = tr.release
			WHERE c.purpose = 'identity' AND fr.geography = tr.geography AND fe.edition_from < te.edition_from
			ORDER BY c.id`,
		)
		.all();
	const chosen = new Map<string, IdentityCrosswalk>();
	for (const row of rows) {
		const crosswalk: IdentityCrosswalk = {
			id: Number(row.id),
			method: String(row.method),
			geographyId: Number(row.geography_id),
			geography: String(row.geography),
			fromReleaseId: Number(row.from_release_id),
			toReleaseId: Number(row.to_release_id),
			fromRelease: String(row.from_release),
			toRelease: String(row.to_release),
			fromEdition: String(row.from_edition),
			toEdition: String(row.to_edition),
		};
		const key = `${crosswalk.toReleaseId}|${crosswalk.fromEdition}`;
		const held = chosen.get(key);
		if (
			!held ||
			(held.method !== "official-lookup" &&
				crosswalk.method === "official-lookup")
		)
			chosen.set(key, crosswalk);
	}
	return [...chosen.values()].sort((a, b) => a.id - b.id);
}

type AreaRow = {
	version_id: number;
	area_id: number;
	code: string;
	name: string;
};

const releaseAreas = (database: DatabaseSync, releaseId: number) =>
	(
		database
			.prepare(
				`SELECT v.id AS version_id, v.area_id, a.code, v.name
				FROM area_version v JOIN area a ON a.id = v.area_id
				WHERE v.release_id = ? AND v.in_inventory = 1`,
			)
			.all(releaseId) as AreaRow[]
	).map((row): ChangeArea => ({
		versionId: row.version_id,
		areaId: row.area_id,
		code: row.code,
		name: row.name,
	}));

/**
 * Leaves out areas that only look like they ended or began. With no link, an
 * area ended or began only when the other release covers its country (a release
 * of Great Britain has no Northern Ireland areas to end) and has no area with
 * its code (an area that kept its code but changed extent continues, so it
 * neither ended nor began).
 */
const withoutFalseEnds = (
	areas: ChangeArea[],
	linked: ReadonlySet<number>,
	other: readonly ChangeArea[],
) => {
	const countries = new Set(other.map((area) => countryOf(area.code)));
	const codes = new Set(other.map((area) => area.areaId));
	return areas.filter(
		(area) =>
			linked.has(area.versionId) ||
			(countries.has(countryOf(area.code)) && !codes.has(area.areaId)),
	);
};

function crosswalkChanges(
	database: DatabaseSync,
	crosswalk: IdentityCrosswalk,
): AreaChange[] {
	const none = new Set(
		(
			database
				.prepare(
					"SELECT from_version_id FROM crosswalk_source WHERE crosswalk_id = ? AND coverage = 0",
				)
				.all(crosswalk.id) as Array<{ from_version_id: number }>
		).map((row) => row.from_version_id),
	);
	const weights = new Map(
		(
			database
				.prepare(
					"SELECT from_version_id, to_version_id, weight FROM crosswalk_weight WHERE crosswalk_id = ? AND basis_id = 'population'",
				)
				.all(crosswalk.id) as Array<{
				from_version_id: number;
				to_version_id: number;
				weight: number;
			}>
		).map((row) => [
			`${row.from_version_id}|${row.to_version_id}`,
			row.weight,
		]),
	);
	const links = (
		database
			.prepare(
				"SELECT from_version_id, to_version_id FROM crosswalk_edge WHERE crosswalk_id = ?",
			)
			.all(crosswalk.id) as Array<{
			from_version_id: number;
			to_version_id: number;
		}>
	)
		.filter((row) => !none.has(row.from_version_id))
		.map((row): ChangeLink => ({
			fromVersionId: row.from_version_id,
			toVersionId: row.to_version_id,
			weight:
				weights.get(`${row.from_version_id}|${row.to_version_id}`) ??
				null,
		}));
	const from = releaseAreas(database, crosswalk.fromReleaseId);
	const to = releaseAreas(database, crosswalk.toReleaseId);
	const linkedFrom = new Set(links.map((link) => link.fromVersionId));
	const linkedTo = new Set(links.map((link) => link.toVersionId));
	return classifyChanges(
		withoutFalseEnds(from, linkedFrom, to),
		withoutFalseEnds(to, linkedTo, from),
		links,
	).filter((change) => change.kind !== "unchanged");
}

/**
 * Predecessor statements that no crosswalk event already holds, grouped by the
 * two releases they name. The statement's child is the later area.
 */
function publisherChanges(
	database: DatabaseSync,
	covered: ReadonlySet<string>,
): ChangeEvent[] {
	const rows = database
		.prepare(
			`SELECT DISTINCT r.parent_version_id AS from_version_id, r.child_version_id AS to_version_id,
				pa.id AS from_area_id, pa.code AS from_code, pv.name AS from_name,
				ca.id AS to_area_id, ca.code AS to_code, cv.name AS to_name,
				pv.release_id AS from_release_id, cv.release_id AS to_release_id,
				g.id AS geography_id, g.slug AS geography,
				fr.release AS from_release, tr.release AS to_release,
				fe.edition_from AS from_edition, te.edition_from AS to_edition
			FROM area_relationship r
			JOIN area_version pv ON pv.id = r.parent_version_id
			JOIN area pa ON pa.id = pv.area_id
			JOIN area_version cv ON cv.id = r.child_version_id
			JOIN area ca ON ca.id = cv.area_id
			JOIN geography g ON g.id = pa.geography_id
			JOIN area_releases fr ON fr.id = pv.release_id
			JOIN area_releases tr ON tr.id = cv.release_id
			JOIN boundary_release_edition fe ON fe.geography = fr.geography AND fe.release = fr.release
			JOIN boundary_release_edition te ON te.geography = tr.geography AND te.release = tr.release
			WHERE r.relation = 'predecessor' AND ca.geography_id = pa.geography_id
				AND pa.id <> ca.id AND fe.edition_from < te.edition_from`,
		)
		.all() as Array<Record<string, string | number>>;
	const groups = new Map<string, typeof rows>();
	for (const row of rows) {
		if (covered.has(`${row.from_area_id}|${row.to_area_id}`)) continue;
		const key = `${row.from_release_id}|${row.to_release_id}`;
		groups.set(key, [...(groups.get(key) ?? []), row]);
	}
	const events: ChangeEvent[] = [];
	for (const group of groups.values()) {
		const first = group[0]!;
		const area = (
			side: "from" | "to",
			row: (typeof rows)[number],
		): ChangeArea => ({
			versionId: Number(row[`${side}_version_id`]),
			areaId: Number(row[`${side}_area_id`]),
			code: String(row[`${side}_code`]),
			name: String(row[`${side}_name`]),
		});
		const from = new Map<number, ChangeArea>();
		const to = new Map<number, ChangeArea>();
		for (const row of group) {
			const f = area("from", row);
			const t = area("to", row);
			from.set(f.versionId, f);
			to.set(t.versionId, t);
		}
		const changes = classifyChanges(
			[...from.values()],
			[...to.values()],
			group.map((row) => ({
				fromVersionId: Number(row.from_version_id),
				toVersionId: Number(row.to_version_id),
				weight: null,
			})),
		);
		for (const change of changes)
			events.push({
				geographyId: Number(first.geography_id),
				geography: String(first.geography),
				fromReleaseId: Number(first.from_release_id),
				toReleaseId: Number(first.to_release_id),
				fromRelease: String(first.from_release),
				toRelease: String(first.to_release),
				effectiveDate: String(first.to_edition),
				source: "publisher",
				crosswalkId: null,
				change,
			});
	}
	return events;
}

/** The events to store, in id order. */
export function buildAreaChangeEvents(database: DatabaseSync): ChangeEvent[] {
	const events: ChangeEvent[] = [];
	const covered = new Set<string>();
	for (const crosswalk of selectIdentityCrosswalks(database))
		for (const change of crosswalkChanges(database, crosswalk)) {
			events.push({
				geographyId: crosswalk.geographyId,
				geography: crosswalk.geography,
				fromReleaseId: crosswalk.fromReleaseId,
				toReleaseId: crosswalk.toReleaseId,
				fromRelease: crosswalk.fromRelease,
				toRelease: crosswalk.toRelease,
				effectiveDate: crosswalk.toEdition,
				source: "crosswalk",
				crosswalkId: crosswalk.id,
				change,
			});
			for (const from of change.from)
				for (const to of change.to)
					covered.add(`${from.areaId}|${to.areaId}`);
		}
	events.push(...publisherChanges(database, covered));
	const smallest = (areas: readonly ChangeArea[]) => areas[0]?.code ?? "";
	return events.sort(
		(a, b) =>
			compareText(a.geography, b.geography) ||
			compareText(a.fromRelease, b.fromRelease) ||
			compareText(a.toRelease, b.toRelease) ||
			compareText(smallest(a.change.from), smallest(b.change.from)) ||
			compareText(smallest(a.change.to), smallest(b.change.to)),
	);
}

/**
 * A member's share is the weight of its link when it has exactly one: the
 * part of an earlier area's residents who are in the later area on that link.
 * A member with several links, or a link with no population weight, has none.
 */
function memberShares(change: AreaChange) {
	const links = new Map<string, ChangeLink[]>();
	for (const link of change.links) {
		for (const key of [
			`from${link.fromVersionId}`,
			`to${link.toVersionId}`,
		])
			links.set(key, [...(links.get(key) ?? []), link]);
	}
	return (side: "from" | "to", area: ChangeArea) => {
		const own = links.get(`${side}${area.versionId}`);
		return own?.length === 1 ? own[0]!.weight : null;
	};
}

/** Creates and fills the change tables and the view, and returns the event count by kind. */
export function writeAreaChangeEvents(
	database: DatabaseSync,
): Map<ChangeKind, number> {
	database.exec(TABLES);
	const addEvent = database.prepare(
		`INSERT INTO area_change_event
			(id, geography_id, from_release_id, to_release_id, kind, effective_date, date_basis, source, crosswalk_id)
		VALUES (?, ?, ?, ?, ?, ?, 'edition', ?, ?)`,
	);
	const addMember = database.prepare(
		"INSERT INTO area_change_member (event_id, side, area_version_id, share) VALUES (?, ?, ?, ?)",
	);
	const counts = new Map<ChangeKind, number>();
	buildAreaChangeEvents(database).forEach((event, index) => {
		const id = index + 1;
		const { change } = event;
		addEvent.run(
			id,
			event.geographyId,
			event.fromReleaseId,
			event.toReleaseId,
			change.kind,
			event.effectiveDate,
			event.source,
			event.crosswalkId,
		);
		const share = memberShares(change);
		for (const area of change.from)
			addMember.run(id, "from", area.versionId, share("from", area));
		for (const area of change.to)
			addMember.run(id, "to", area.versionId, share("to", area));
		counts.set(change.kind, (counts.get(change.kind) ?? 0) + 1);
	});
	return counts;
}
