import type { AreaInventory } from "./areaInventory";
import type { BoundaryRegistry } from "./boundaryRegistry";
import { releaseKey } from "./geographyKeys";

type BoundaryRelease = BoundaryRegistry["releases"][number];

/** A release's month as `YYYY-MM`, from its id; undefined when it has none. */
export const releaseMonth = (id: string): string | undefined =>
	/^(\d{4}-(0[1-9]|1[0-2]))(?:-|$)/.exec(id)?.[1];

/**
 * A calendar date as `YYYY-MM-DD`, or a month as `YYYY-MM`, and the month it
 * falls in; undefined when it is neither.
 */
export const parseSelectionDate = (
	date: string,
): { date: string; month: string } | undefined => {
	const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(date);
	if (!match) return undefined;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = match[3] === undefined ? 1 : Number(match[3]);
	const calendar = new Date(Date.UTC(year, month - 1, day));
	return calendar.getUTCFullYear() === year &&
		calendar.getUTCMonth() === month - 1 &&
		calendar.getUTCDate() === day
		? { date, month: date.slice(0, 7) }
		: undefined;
};

/** Each compiled release derived from another, as `geography/release` pairs. */
export const derivedReleaseSources = (
	areaInventory: AreaInventory | undefined,
): Map<string, string> =>
	new Map(
		(areaInventory?.releases ?? []).flatMap((release) =>
			release.status === "available" && release.derivedFrom
				? [
						[
							releaseKey(release.geography, release.id),
							releaseKey(release.derivedFrom.source.geography, release.derivedFrom.source.boundaryRelease),
						] as const,
					]
				: [],
		),
	);

export type ReleaseReference = {
	id: string;
	month: string;
	title: string;
	countries: string[];
	href: string;
};

export type ReleaseSelection =
	| {
			status: "selected";
			selected: ReleaseReference;
			/** The date falls in the selected release's own month. */
			sameMonth: boolean;
			previous: ReleaseReference | null;
			next: ReleaseReference | null;
			/** Same-month releases set aside, and why. */
			setAside: Array<ReleaseReference & { reason: string }>;
			/** Later releases on or before the date that miss the country. */
			notCovering: ReleaseReference[];
			undated: string[];
	  }
	| {
			status: "ambiguous";
			month: string;
			choices: ReleaseReference[];
	  }
	| {
			status: "none";
			absence:
				| "unknown-geography"
				| "no-dated-release"
				| "country-not-covered"
				| "before-first-release";
			detail: string;
			earliest?: ReleaseReference;
			undated: string[];
	  };

const reference = (release: BoundaryRelease): ReleaseReference => ({
	id: release.id,
	month: releaseMonth(release.id) as string,
	title: release.title,
	countries: release.coverage.countries,
	href: `/v1/boundary-releases/${release.geography}/${release.id}`,
});

const byMonth = (left: ReleaseReference, right: ReleaseReference) =>
	left.month.localeCompare(right.month) || left.id.localeCompare(right.id);

/**
 * The boundary release to use for a date: the latest one dated on or before it
 * that covers the country asked for.
 *
 * Releases are snapshots dated to a month, so this is the latest snapshot at
 * that date, not a claim about which boundaries were legally in force on it.
 * A change between the snapshot and the date is only visible in the next
 * release, which is returned beside it.
 *
 * Releases of the same month are only told apart where one is plainly the
 * better answer: a subset derived from another loses to its source, and a
 * release covering more of the requested countries wins. Variants that differ
 * in some other way, such as clipping, are returned as an ambiguity rather
 * than chosen between.
 */
export const selectReleaseForDate = (
	registry: BoundaryRegistry,
	geography: string,
	month: string,
	country: string | undefined,
	derivedFrom: Map<string, string>,
): ReleaseSelection => {
	const releases = registry.releases.filter(
		(release) => release.geography === geography,
	);
	const undated = releases
		.filter((release) => releaseMonth(release.id) === undefined)
		.map((release) => release.id)
		.sort();
	if (releases.length === 0) {
		return {
			status: "none",
			absence: "unknown-geography",
			detail: `No boundary release is published for the geography ${geography}.`,
			undated,
		};
	}
	const dated = releases
		.filter((release) => releaseMonth(release.id) !== undefined)
		.map(reference)
		.sort(byMonth);
	if (dated.length === 0) {
		return {
			status: "none",
			absence: "no-dated-release",
			detail: `No ${geography} boundary release is dated to a month, so none can be chosen by date.`,
			undated,
		};
	}
	const covering = dated.filter(
		(release) => !country || release.countries.includes(country),
	);
	if (covering.length === 0) {
		return {
			status: "none",
			absence: "country-not-covered",
			detail: `No ${geography} boundary release covers ${country}.`,
			undated,
		};
	}
	const onOrBefore = covering.filter((release) => release.month <= month);
	if (onOrBefore.length === 0) {
		return {
			status: "none",
			absence: "before-first-release",
			detail: `The earliest ${geography} boundary release${country ? ` covering ${country}` : ""} is dated ${covering[0]!.month}, after ${month}.`,
			earliest: covering[0],
			undated,
		};
	}
	const chosenMonth = onOrBefore.at(-1)!.month;
	let candidates = onOrBefore.filter(
		(release) => release.month === chosenMonth,
	);
	const setAside: Array<ReleaseReference & { reason: string }> = [];
	const setAsideWhere = (
		test: (release: ReleaseReference) => boolean,
		reason: (release: ReleaseReference) => string,
	) => {
		const kept = candidates.filter((release) => !test(release));
		if (kept.length === 0) return;
		for (const release of candidates)
			if (test(release))
				setAside.push({ ...release, reason: reason(release) });
		candidates = kept;
	};
	setAsideWhere(
		(release) =>
			candidates.some(
				(source) =>
					derivedFrom.get(releaseKey(geography, release.id)) ===
					releaseKey(geography, source.id),
			),
		(release) =>
			`Derived from ${derivedFrom.get(releaseKey(geography, release.id))}, which is also dated ${chosenMonth}.`,
	);
	const reach = (release: ReleaseReference) =>
		country ? 0 : release.countries.length;
	const widest = Math.max(...candidates.map(reach));
	setAsideWhere(
		(release) => reach(release) < widest,
		(release) =>
			`Covers ${release.countries.join(", ")}, fewer countries than another release dated ${chosenMonth}.`,
	);
	if (candidates.length > 1) {
		return { status: "ambiguous", month: chosenMonth, choices: candidates };
	}
	const selected = candidates[0]!;
	return {
		status: "selected",
		selected,
		sameMonth: chosenMonth === month,
		previous:
			covering.filter((release) => release.month < chosenMonth).at(-1) ??
			null,
		next: covering.find((release) => release.month > chosenMonth) ?? null,
		setAside,
		notCovering: dated.filter(
			(release) =>
				release.month > chosenMonth &&
				release.month <= month &&
				!covering.includes(release),
		),
		undated,
	};
};
