import { countryOf, geographyNoun } from "@/lib/places/labels";
import { PLACE_INDEX } from "@/lib/places/load";
import { releaseLabel, type AreaProfile } from "@/lib/places/profile";

/** One sentence on what an area is and which boundary releases carry it. */
export function areaSummary(profile: AreaProfile) {
	const noun = geographyNoun(profile.geography);
	const council = profile.parents.find(
		(parent) => parent.geography === "localAuthority",
	);
	const country = countryOf(profile.code);
	const where = [council?.name, country].filter(Boolean).join(", ");
	const releases = PLACE_INDEX.releases[profile.geography];
	const first = releaseLabel(releases[profile.releases[0]!]!);
	const last = releaseLabel(releases[profile.releases.at(-1)!]!);
	return profile.current
		? `${profile.name} is a ${noun}${where ? ` in ${where}` : ""}, published in boundary releases since ${first}.`
		: `${profile.name} was a ${noun}${where ? ` in ${where}` : ""}, published in boundary releases from ${first} to ${last}.`;
}
