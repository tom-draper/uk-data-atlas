import { releaseMonth, supersededAt } from "./releaseForDate";
import type { AreasResolver } from "./resolver/areas";

/** The country release to place a point with: for the date, else the latest. */
export const countryRelease = (
	resolver: Pick<AreasResolver, "boundaryReleasesFor" | "hasAreaRelease">,
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
