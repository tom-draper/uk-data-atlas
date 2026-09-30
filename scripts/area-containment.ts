/**
 * The atlas's ward containment, compiled from the API geography resolver's
 * crosswalks: the local authority and constituencies each served ward
 * release sits in. The atlas cannot hold the crosswalks, so this reduces them
 * to the lookups it reads (`boundary-mappings.json`), in place of deriving
 * them again from boundary files, so the map places a ward where the API does.
 */
import type { PrecompiledBoundaryMappings } from "../lib/data/boundaries/mappings";

/** The parts of a resolver crosswalk the atlas's containment reads. */
export type ContainmentCrosswalk = {
	id: string;
	method: string;
	from: { geography: string; boundaryRelease: string };
	to: { geography: string; boundaryRelease: string };
	records: Array<{
		source: { code: string };
		targets: Array<{ code: string }>;
	}>;
};

/** A served ward release: the atlas year and the release it is drawn from. */
export type WardRelease = { year: number; release: string };

const fromWards = (crosswalk: ContainmentCrosswalk, release: string) =>
	crosswalk.from.geography === "ward" &&
	crosswalk.from.boundaryRelease === release;

const invert = (parents: Map<string, string>) => {
	const members: Record<string, string[]> = {};
	for (const [ward, parent] of [...parents].sort(([left], [right]) =>
		left.localeCompare(right),
	))
		(members[parent] ??= []).push(ward);
	return members;
};

const singleTargets = (crosswalk: ContainmentCrosswalk) =>
	new Map(
		crosswalk.records.flatMap((record) =>
			record.targets.length === 1
				? [[record.source.code, record.targets[0]!.code] as const]
				: [],
		),
	);

/**
 * Where a ward release names each ward's local authority, its authorities are
 * the ones of its own era, published as a clean containment. Wards of the
 * releases that name none take the newest authority holding most of them,
 * which is the vocabulary the gazetteer's locations mostly speak; a ward
 * already placed by a release that named its authority keeps that one.
 *
 * Each ward release is placed in a constituency of every code set by best fit,
 * so a ward-valued measure summed into a constituency counts each ward once.
 * Where ONS publishes a lookup for the release, it decides every ward it does
 * not split.
 */
export const compileAreaContainment = (
	wardReleases: WardRelease[],
	crosswalks: ContainmentCrosswalk[],
): PrecompiledBoundaryMappings => {
	const ordered = [...wardReleases].sort(
		(left, right) => left.year - right.year,
	);
	const wardToLad: Record<string, string> = {};
	const ladToWards: PrecompiledBoundaryMappings["ladToWards"] = {};
	const constituencyToWards: PrecompiledBoundaryMappings["constituencyToWards"] =
		{};

	for (const { year, release } of ordered) {
		const published = crosswalks.find(
			(crosswalk) =>
				fromWards(crosswalk, release) &&
				crosswalk.method === "clean-containment" &&
				crosswalk.to.geography === "localAuthority",
		);
		if (!published) continue;
		const parents = singleTargets(published);
		for (const [ward, lad] of parents) wardToLad[ward] = lad;
		ladToWards[year] = invert(parents);
	}

	for (const { release } of ordered) {
		if (
			crosswalks.some(
				(crosswalk) =>
					fromWards(crosswalk, release) &&
					crosswalk.method === "clean-containment" &&
					crosswalk.to.geography === "localAuthority",
			)
		)
			continue;
		const bestFit = crosswalks.find(
			(crosswalk) =>
				fromWards(crosswalk, release) &&
				crosswalk.method === "best-fit" &&
				crosswalk.to.geography === "localAuthority",
		);
		if (!bestFit)
			throw new Error(
				`ward/${release} names no local authority and the resolver has no best fit for one.`,
			);
		for (const [ward, lad] of singleTargets(bestFit))
			wardToLad[ward] ??= lad;
	}

	for (const { year, release } of ordered) {
		const bestFits = crosswalks
			.filter(
				(crosswalk) =>
					fromWards(crosswalk, release) &&
					crosswalk.method === "best-fit" &&
					crosswalk.to.geography === "constituency",
			)
			.sort((left, right) => left.id.localeCompare(right.id));
		if (bestFits.length === 0)
			throw new Error(
				`The resolver places ward/${release} in no constituency.`,
			);
		const members: Record<string, string[]> = {};
		for (const bestFit of bestFits) {
			const parents = singleTargets(bestFit);
			const official = crosswalks.find(
				(crosswalk) =>
					fromWards(crosswalk, release) &&
					crosswalk.method === "official-lookup" &&
					crosswalk.to.geography === "constituency" &&
					crosswalk.to.boundaryRelease === bestFit.to.boundaryRelease,
			);
			if (official)
				for (const [ward, constituency] of singleTargets(official))
					parents.set(ward, constituency);
			Object.assign(members, invert(parents));
		}
		constituencyToWards[year] = members;
	}

	return { wardToLad, ladToWards, constituencyToWards };
};
