import type {
	AreaRef,
	PlaceGeography,
	TimelineEvent,
} from "@uk-data-atlas/catalogue/place-profile";
import type { readPlaceResolver } from "./placeResolver.ts";
import {
	contemporary,
	namedRef,
	ref,
	uniqueRefs,
	type Relationship,
} from "./placeProfileRefs.ts";

const REDRAWN_SHARE = 0.02;
const REDRAWN_KM2 = 0.05;

export function buildAreaTimeline({
	geography,
	code,
	releases,
	covering,
	areas,
	nameIn,
	relationshipsIn,
	lastRelationships,
	current,
	ending,
}: {
	geography: PlaceGeography;
	code: string;
	releases: string[];
	covering: string[];
	areas: Map<string, Map<string, number>>;
	nameIn: (release: string) => string;
	relationshipsIn: (release: string) => Relationship[];
	lastRelationships: Relationship[];
	current: boolean;
	ending: string | undefined;
}) {
	const first = releases[0]!;
	const last = releases.at(-1)!;
	const timeline: TimelineEvent[] = [];
	timeline.push({
		kind: "first-published",
		release: first,
		archiveStart: first === covering[0],
	});

	// Links to other codes of the same geography, from every release that
	// holds this one. A crosswalk can link releases years apart, so a link is
	// placed by the counterpart's release, not by the release it was read in.
	const formedFrom = new Map<string, Relationship>();
	const gained: { release: string; relationship: Relationship }[] = [];
	const lost: Relationship[] = [];
	const succeededBy = new Map<string, Relationship>();
	let previousName = nameIn(first);
	let previousArea = areas.get(first)?.get(code);
	let previousCouncil: AreaRef | null = null;
	releases.forEach((release, index) => {
		const relationships = relationshipsIn(release);
		for (const relationship of relationships) {
			const { counterpart } = relationship;
			if (
				counterpart.geography !== geography ||
				counterpart.code === code
			)
				continue;
			if (counterpart.boundaryRelease < first)
				formedFrom.set(counterpart.code, relationship);
			else if (counterpart.boundaryRelease > last)
				succeededBy.set(counterpart.code, relationship);
			else if (counterpart.boundaryRelease < release)
				gained.push({ release, relationship });
			else if (counterpart.boundaryRelease > release)
				lost.push(relationship);
		}

		const name = nameIn(release);
		if (index > 0 && name !== previousName)
			timeline.push({
				kind: "renamed",
				release,
				from: previousName,
				to: name,
			});
		previousName = name;

		const area = areas.get(release)?.get(code);
		if (index > 0 && area !== undefined && previousArea !== undefined) {
			const change = Math.abs(area - previousArea);
			if (change > REDRAWN_KM2 && change / previousArea > REDRAWN_SHARE)
				timeline.push({
					kind: "redrawn",
					release,
					fromKm2: previousArea,
					toKm2: area,
				});
		}
		if (area !== undefined) previousArea = area;

		// The council a ward sat in, read only from a council release of about
		// the same time: a crosswalk to a council release years later says
		// where the ward's ground went, not which council it belonged to.
		if (geography === "ward") {
			const council = contemporary(
				relationships.filter(
					({ relation, counterpart }) =>
						relation === "within" &&
						counterpart.geography === "localAuthority",
				),
				release,
			);
			if (council) {
				if (previousCouncil && council.code !== previousCouncil.code)
					timeline.push({
						kind: "parent-changed",
						release,
						geography: "localAuthority",
						from: previousCouncil,
						to: council,
					});
				previousCouncil = council;
			}
		}
	});
	const byRelation = (relationships: Relationship[]) => {
		const groups = new Map<string, Relationship[]>();
		for (const relationship of relationships)
			groups.set(relationship.relation, [
				...(groups.get(relationship.relation) ?? []),
				relationship,
			]);
		return [...groups];
	};
	// One event for how it was formed. Links of different kinds, as when a
	// constituency takes over one seat and part of another, read as "parts".
	const formedBy = byRelation([...formedFrom.values()]);
	if (formedBy.length > 0)
		timeline.push({
			kind: "formed",
			release: first,
			relation: formedBy.length === 1 ? formedBy[0]![0] : "mixed",
			areas: uniqueRefs([...formedFrom.values()].map(ref)).sort((a, b) =>
				a.name.localeCompare(b.name),
			),
		});
	for (const { release, relationship } of gained)
		timeline.push({
			kind: "gained",
			release,
			relation: relationship.relation,
			areas: [ref(relationship)],
		});
	for (const relationship of lost)
		timeline.push({
			kind: "lost",
			release: relationship.counterpart.boundaryRelease,
			relation: relationship.relation,
			areas: [ref(relationship)],
		});

	// A ward's constituency, as each constituency release places it.
	if (geography === "ward") {
		const constituencies = lastRelationships
			.filter(
				({ relation, counterpart }) =>
					relation === "within" &&
					counterpart.geography === "constituency",
			)
			.map(ref)
			.filter((constituency) => !ending || constituency.release < ending)
			.sort((a, b) => a.release.localeCompare(b.release));
		constituencies.forEach((constituency, index) => {
			const before = constituencies[index - 1];
			if (before && before.code !== constituency.code)
				timeline.push({
					kind: "parent-changed",
					release: constituency.release,
					geography: "constituency",
					from: before,
					to: constituency,
				});
		});
	}

	if (!current) {
		const successors = [...succeededBy.values()].sort((a, b) =>
			a.counterpart.boundaryRelease.localeCompare(
				b.counterpart.boundaryRelease,
			),
		);
		const [{ relation } = { relation: "none" }] = successors;
		timeline.push({
			kind: "ended",
			release: successors[0]?.counterpart.boundaryRelease ?? ending!,
			relation,
			areas: uniqueRefs(
				successors
					.filter((link) => link.relation === relation)
					.map(ref),
			),
		});
	}

	return { timeline, previousCouncil };
}

export function addNamedPlaceEvents(
	timeline: TimelineEvent[],
	locations: ReturnType<
		ReturnType<typeof readPlaceResolver>["namedLocations"]
	>,
	code: string,
	first: string,
	ending: string | undefined,
) {
	// When a council joined or left a named place during its own life; a date
	// at its start or end only restates that it was formed or abolished.
	const lifeStart = first.slice(0, 7);
	const lifeEnd = ending?.slice(0, 7) ?? "9999";
	for (const location of locations)
		for (const assertion of location.memberAssertions ?? []) {
			if (assertion.code !== code) continue;
			const place = namedRef(location);
			const { from, to } = assertion.validity;
			if (
				from &&
				from.slice(0, 7) > lifeStart &&
				from.slice(0, 7) < lifeEnd
			)
				timeline.push({ kind: "joined", date: from, place });
			if (to && to.slice(0, 7) > lifeStart && to.slice(0, 7) < lifeEnd)
				timeline.push({ kind: "left", date: to, place });
		}
}
