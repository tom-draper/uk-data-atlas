import { areaKindNoun, countryOf, listNames } from "@/lib/places/labels";
import { loadPlaceIndex } from "@/lib/places/load";
import {
	releaseLabel,
	type AreaProfile,
} from "@uk-data-atlas/catalogue/place-profile";

/** One sentence on what an area is and which boundary releases carry it. */
export async function areaSummary(profile: AreaProfile) {
	const noun = areaKindNoun(profile);
	const council = profile.parents.find(
		(parent) => parent.geography === "localAuthority",
	);
	const country = countryOf(profile.code);
	const where = [council?.name, country].filter(Boolean).join(", ");
	const releases = (await loadPlaceIndex()).releases[profile.geography];
	const first = releaseLabel(releases[profile.releases[0]!]!);
	const last = releaseLabel(releases[profile.releases.at(-1)!]!);
	if (profile.geography === "majorTownAndCity") {
		const councils = profile.overlaps
			.filter((group) => group.geography === "localAuthority")
			.flatMap((group) => group.areas ?? [])
			.map((council) => council.name);
		return `${profile.name} is one of the major towns and cities of England and Wales, as ONS drew them in ${first.split(" ")[1]} from built-up areas${councils.length ? `, ${councils.length === 1 ? "in" : "spanning"} ${listNames(councils)}` : ""}.`;
	}
	return profile.current
		? `${profile.name} is ${noun}${where ? ` in ${where}` : ""}, published in boundary releases since ${first}.`
		: `${profile.name} was ${noun}${where ? ` in ${where}` : ""}, published in boundary releases from ${first} to ${last}.`;
}
