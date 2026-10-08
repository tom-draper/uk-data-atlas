import { namedHref } from "@/lib/places/labels";
import type { NamedRef } from "@/lib/places/profile";

export type Crumb = { label: string; href?: string };

export const UNITED_KINGDOM: NamedRef = {
	id: "united-kingdom",
	label: "United Kingdom",
	kind: "country",
};

/** The nations, by the letter their area codes begin with. */
export const NATIONS: Record<string, NamedRef> = {
	E: { id: "england", label: "England", kind: "country" },
	W: { id: "wales", label: "Wales", kind: "country" },
	S: { id: "scotland", label: "Scotland", kind: "country" },
	N: { id: "northern-ireland", label: "Northern Ireland", kind: "country" },
};

/**
 * Where a place sits, broadest first: the UK, its nation, its English region,
 * then its council for a ward. So a page says where it is before its map does.
 */
export function placeTrail(
	nested: (NamedRef | undefined)[],
	...areas: Crumb[]
) {
	return [
		{ label: "Places", href: "/places" },
		...[UNITED_KINGDOM, ...nested]
			.filter((place): place is NamedRef => place !== undefined)
			.map((place) => ({ label: place.label, href: namedHref(place) })),
		...areas,
	];
}

export const regionIn = (places: NamedRef[] | undefined) =>
	places?.find((place) => place.kind === "region");
