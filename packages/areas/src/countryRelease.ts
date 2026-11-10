import type { BoundaryRegistry } from "@uk-data-atlas/geography";
import {
	releaseMonth,
	supersededAt,
	type ReleaseSelection,
} from "./releaseForDate.ts";

type BoundaryRelease = BoundaryRegistry["releases"][number];

/**
 * What choosing a release needs from the compiled releases: which have area
 * identities, which are published, and which one a date selects. The loader's
 * areas resolver satisfies it.
 */
export type AreaReleaseSource = {
	hasAreaRelease(geography: string, boundaryRelease: string): boolean;
	boundaryRelease(geography: string, id: string): BoundaryRelease | undefined;
	boundaryReleasesFor(geography?: string): BoundaryRelease[];
	selectReleaseForDate(
		geography: string,
		month: string,
		country?: string,
	): ReleaseSelection | undefined;
};

/** The country release to place a point with: for the date, else the latest. */
export const countryRelease = (
	resolver: Pick<AreaReleaseSource, "boundaryReleasesFor" | "hasAreaRelease">,
	month: string | undefined,
): string | undefined => {
	const countries = resolver.boundaryReleasesFor("country");
	const dated = countries
		.filter(
			(release) =>
				release.geography === "country" &&
				releaseMonth(release.id) !== undefined &&
				resolver.hasAreaRelease("country", release.id) &&
				!supersededAt(
					countries,
					release,
					[month ?? "9999-12", releaseMonth(release.id)!].sort()[1]!,
				),
		)
		.sort((left, right) => left.id.localeCompare(right.id));
	if (dated.length === 0) return undefined;
	if (month === undefined) return dated.at(-1)!.id;
	return (
		dated.filter((release) => releaseMonth(release.id)! <= month).at(-1) ??
		dated[0]!
	).id;
};
