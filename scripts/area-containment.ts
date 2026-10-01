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

/** A served LSOA release: the atlas year and the release it is drawn from. */
export type LsoaRelease = { year: number; release: string };

/**
 * Each served LSOA release placed in the newest local authorities, the
 * vocabulary the gazetteer's locations speak. Where ONS publishes an LSOA's
 * authority, it decides wherever that authority carries on to the newest
 * release under the resolver's lineage; every other LSOA takes the
 * authority holding most of it.
 */
export const compileLsoaLadContainment = (
	lsoaReleases: LsoaRelease[],
	crosswalks: ContainmentCrosswalk[],
	carryOn: (code: string, release: string) => string | undefined,
): Record<number, Record<string, string>> => {
	const fromLsoas = (crosswalk: ContainmentCrosswalk, release: string) =>
		crosswalk.from.geography === "lsoa" &&
		crosswalk.from.boundaryRelease === release &&
		crosswalk.to.geography === "localAuthority";
	const lsoaToLad: Record<number, Record<string, string>> = {};
	for (const { year, release } of lsoaReleases) {
		const bestFit = crosswalks.find(
			(crosswalk) =>
				fromLsoas(crosswalk, release) &&
				crosswalk.method === "best-fit",
		);
		if (!bestFit)
			throw new Error(
				`The resolver places lsoa/${release} in no local authority.`,
			);
		const parents = singleTargets(bestFit);
		for (const published of crosswalks.filter(
			(crosswalk) =>
				fromLsoas(crosswalk, release) &&
				crosswalk.method === "clean-containment",
		))
			for (const [lsoa, lad] of singleTargets(published)) {
				const newest = carryOn(lad, published.to.boundaryRelease);
				if (newest) parents.set(lsoa, newest);
			}
		lsoaToLad[year] = Object.fromEntries(
			[...parents].sort(([left], [right]) => left.localeCompare(right)),
		);
	}
	return lsoaToLad;
};

/** The parts of a resolver overlap crosswalk the atlas's overlaps read. */
export type OverlapCrosswalk = {
	id: string;
	method: string;
	from: { geography: string; boundaryRelease: string };
	to: { geography: string; boundaryRelease: string };
	weighting: { basis?: string; population?: string };
	records: Array<{
		source: { code: string };
		targets: Array<{ code: string; weight?: number }>;
	}>;
};

/** A served constituency release and the codes it holds. */
export type ConstituencyRelease = { release: string; codes: string[] };

const WEIGHT_PLACES = 4;

/**
 * Each served constituency release's local authorities, with the share of
 * each constituency they hold, from the resolver's overlap crosswalks into
 * one local authority release. Releases of one code set differ only in how
 * their boundaries are generalised, so each reads the crosswalks of the
 * release that holds every code it does. A constituency is weighted by
 * residents where a population overlap covers it, and by area elsewhere, as
 * in Northern Ireland.
 */
export const compileConstituencyLadOverlaps = (
	releases: ConstituencyRelease[],
	crosswalks: OverlapCrosswalk[],
): {
	weighting: Record<string, string>;
	releases: Record<
		string,
		Record<string, Array<{ code: string; weight: number }>>
	>;
} => {
	const areaOverlaps = crosswalks.filter(
		(crosswalk) => crosswalk.method === "area-overlap",
	);
	const used = new Set<OverlapCrosswalk>();
	const compiled: Record<
		string,
		Record<string, Array<{ code: string; weight: number }>>
	> = {};
	for (const { release, codes } of releases) {
		const holds = (crosswalk: OverlapCrosswalk) => {
			const sources = new Set(
				crosswalk.records.map(({ source }) => source.code),
			);
			return codes.every((code) => sources.has(code));
		};
		// The release's own crosswalk where there is one, else another
		// release of its code set.
		const area =
			areaOverlaps.find(
				(crosswalk) => crosswalk.from.boundaryRelease === release,
			) ?? areaOverlaps.find(holds);
		if (!area || !holds(area))
			throw new Error(
				`The resolver has no local authority overlap for every constituency of ${release}.`,
			);
		const population = crosswalks.filter(
			(crosswalk) =>
				crosswalk.method === "population-overlap" &&
				crosswalk.from.boundaryRelease === area.from.boundaryRelease,
		);
		const targetsOf = new Map(
			[area, ...population].flatMap((crosswalk) =>
				crosswalk.records.map(
					(record) =>
						[record.source.code, { crosswalk, record }] as const,
				),
			),
		);
		const wanted = new Set(codes);
		const overlaps: Record<
			string,
			Array<{ code: string; weight: number }>
		> = {};
		for (const [code, { crosswalk, record }] of [...targetsOf].sort(
			([left], [right]) => left.localeCompare(right),
		)) {
			if (!wanted.has(code)) continue;
			used.add(crosswalk);
			overlaps[code] = record.targets
				.map((target) => ({
					code: target.code,
					weight: Number((target.weight ?? 0).toFixed(WEIGHT_PLACES)),
				}))
				.filter(({ weight }) => weight > 0)
				.sort(
					(left, right) =>
						right.weight - left.weight ||
						left.code.localeCompare(right.code),
				);
		}
		compiled[release] = overlaps;
	}
	return {
		weighting: Object.fromEntries(
			[...used]
				.sort((left, right) => left.id.localeCompare(right.id))
				.map((crosswalk) => [
					crosswalk.id,
					crosswalk.weighting.population ??
						crosswalk.weighting.basis ??
						"unweighted",
				]),
		),
		releases: compiled,
	};
};

/** A served parish release: the atlas year and the release it is drawn from. */
export type ParishRelease = { year: number; release: string };

/** A release id's date, `2019-04` of `2019-04-ew-bgc`. */
const releaseDate = (release: string) => release.slice(0, 7);

/**
 * Each served parish release placed in the local authorities of its own era:
 * the newest local authority release not after the parish release, as the
 * authority an upload of that era names. Where ONS publishes a release's
 * lookup it decides; another release takes the authority holding most of
 * each parish.
 */
export const compileParishLadContainment = (
	parishReleases: ParishRelease[],
	crosswalks: ContainmentCrosswalk[],
): Record<number, Record<string, string>> => {
	const METHOD_RANK = ["clean-containment", "best-fit"];
	const parishToLad: Record<number, Record<string, string>> = {};
	for (const { year, release } of parishReleases) {
		const candidates = crosswalks.filter(
			(crosswalk) =>
				crosswalk.from.geography === "parish" &&
				crosswalk.from.boundaryRelease === release &&
				crosswalk.to.geography === "localAuthority" &&
				METHOD_RANK.includes(crosswalk.method),
		);
		const era = (crosswalk: ContainmentCrosswalk) =>
			releaseDate(crosswalk.to.boundaryRelease) <= releaseDate(release);
		const [chosen] = candidates.sort(
			(left, right) =>
				METHOD_RANK.indexOf(left.method) -
					METHOD_RANK.indexOf(right.method) ||
				Number(era(right)) - Number(era(left)) ||
				(era(left)
					? right.to.boundaryRelease.localeCompare(
							left.to.boundaryRelease,
						)
					: left.to.boundaryRelease.localeCompare(
							right.to.boundaryRelease,
						)),
		);
		if (!chosen)
			throw new Error(
				`The resolver places parish/${release} in no local authority.`,
			);
		parishToLad[year] = Object.fromEntries(
			[...singleTargets(chosen)].sort(([left], [right]) =>
				left.localeCompare(right),
			),
		);
	}
	return parishToLad;
};
