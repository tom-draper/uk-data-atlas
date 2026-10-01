/**
 * Where each area of one geography goes from release to release, as the
 * resolver's `successorArea` answers it: the same area, or the one that
 * succeeded it across a redrawing that kept nearly all of each, compacted for a client that cannot hold
 * the crosswalks: the atlas reads it to find a hovered area in another year's
 * data. Pure and dependency-free, so the site and the API share it.
 */

/** A code in the next or previous release, or null where no area is the same. */
export type LineageStep = Record<string, string | null>;

export type AreaLineage = {
	schemaVersion: 1;
	geography: string;
	/** Oldest first. */
	releases: string[];
	/**
	 * Between `releases[i]` and `releases[i + 1]`, only the areas that do not
	 * carry on under their own code: `forward` from the earlier release,
	 * `backward` from the later one. Every other code of a release is the same
	 * area under the same code in its neighbour.
	 */
	steps: Array<{ forward: LineageStep; backward: LineageStep }>;
	/**
	 * Where the answer between two releases further apart is not the one the
	 * steps compose to, keyed `from>to`. A publisher's lookup can join two
	 * releases directly, as the 2010 to 2024 constituency lookup does, where a
	 * derived step between two releases in the middle cannot tell an area's
	 * extent held; the direct answer is the resolver's, so it is kept.
	 */
	overrides: Record<string, LineageStep>;
};

const pairKey = (from: string, to: string) => `${from}>${to}`;

/** The code the steps compose to, or null where the area stops on the way. */
const compose = (
	lineage: Pick<AreaLineage, "steps">,
	code: string,
	from: number,
	to: number,
): string | null => {
	let current: string | null = code;
	if (from < to)
		for (let index = from; index < to && current !== null; index += 1) {
			const next: string | null | undefined =
				lineage.steps[index]!.forward[current];
			current = next === undefined ? current : next;
		}
	else
		for (
			let index = from - 1;
			index >= to && current !== null;
			index -= 1
		) {
			const previous: string | null | undefined =
				lineage.steps[index]!.backward[current];
			current = previous === undefined ? current : previous;
		}
	return current;
};

/**
 * Compile a lineage from the same-area answer between every two releases,
 * asked of every code of each: stored as steps between neighbours, and
 * overrides where a longer answer is not what the steps compose to.
 */
export const compileAreaLineage = (
	geography: string,
	releases: string[],
	codesOf: (release: string) => Iterable<string>,
	sameArea: (code: string, from: string, to: string) => string | undefined,
): AreaLineage => {
	const codes = new Map(
		releases.map((release) => [release, [...codesOf(release)].sort()]),
	);
	const exceptions = (from: string, to: string): LineageStep => {
		const step: LineageStep = {};
		for (const code of codes.get(from)!) {
			const same = sameArea(code, from, to) ?? null;
			if (same !== code) step[code] = same;
		}
		return step;
	};
	const steps = releases.slice(1).map((to, index) => {
		const from = releases[index]!;
		return {
			forward: exceptions(from, to),
			backward: exceptions(to, from),
		};
	});
	const overrides: Record<string, LineageStep> = {};
	releases.forEach((from, fromIndex) =>
		releases.forEach((to, toIndex) => {
			if (Math.abs(fromIndex - toIndex) < 2) return;
			for (const code of codes.get(from)!) {
				const same = sameArea(code, from, to) ?? null;
				if (same !== compose({ steps }, code, fromIndex, toIndex))
					(overrides[pairKey(from, to)] ??= {})[code] = same;
			}
		}),
	);
	return { schemaVersion: 1, geography, releases, steps, overrides };
};

/**
 * The code of the same area in another release, or undefined where no area
 * of it is the same, or either release is not in the lineage.
 */
export const followLineage = (
	lineage: AreaLineage,
	code: string,
	fromRelease: string,
	toRelease: string,
): string | undefined => {
	const from = lineage.releases.indexOf(fromRelease);
	const to = lineage.releases.indexOf(toRelease);
	if (from < 0 || to < 0) return undefined;
	const override = lineage.overrides[pairKey(fromRelease, toRelease)]?.[code];
	if (override !== undefined) return override ?? undefined;
	return compose(lineage, code, from, to) ?? undefined;
};

/**
 * The releases each code is listed in, as a code that does not carry on
 * unchanged into a neighbour. A code never listed is the same area under the
 * same code in every release that holds it.
 */
export const listedReleases = (lineage: AreaLineage): Map<string, number[]> => {
	const listed = new Map<string, Set<number>>();
	const add = (code: string, index: number) => {
		const releases = listed.get(code) ?? new Set<number>();
		releases.add(index);
		listed.set(code, releases);
	};
	lineage.steps.forEach((step, index) => {
		for (const code of Object.keys(step.forward)) add(code, index);
		for (const code of Object.keys(step.backward)) add(code, index + 1);
	});
	return new Map(
		[...listed].map(([code, releases]) => [
			code,
			[...releases].sort((left, right) => left - right),
		]),
	);
};

/**
 * The code of the same area in another release, for a code whose own release
 * is not known, such as one a dataset publishes. It is followed from the
 * nearest release the lineage lists it in, which holds it; a code the lineage
 * never lists carries on unchanged. Where one code named two extents, as when
 * a boundary moved but its code did not, the nearer one is meant.
 */
export const followLineageFromCode = (
	lineage: AreaLineage,
	listed: Map<string, number[]>,
	code: string,
	toRelease: string,
): string | undefined => {
	const to = lineage.releases.indexOf(toRelease);
	if (to < 0) return undefined;
	const releases = listed.get(code);
	if (!releases) return code;
	const nearest = releases.reduce((best, index) =>
		Math.abs(index - to) < Math.abs(best - to) ||
		(Math.abs(index - to) === Math.abs(best - to) && index > best)
			? index
			: best,
	);
	return followLineage(lineage, code, lineage.releases[nearest]!, toRelease);
};
