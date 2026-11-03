import {
	encodeOutline,
	type NamedProfile,
	type Outline,
	type PlaceIndex,
} from "@uk-data-atlas/catalogue/place-profile";
import type { readPlaceResolver } from "./placeResolver";
import { boundsOf } from "./placeProfileGeometry";
import { namedRef } from "./placeProfileRefs";

export function buildNamedPlaceProfiles({
	resolver,
	newestCouncilRelease,
	councilNames,
	polygonsOf,
	mapsSlugByName,
	outputs,
	index,
}: {
	resolver: ReturnType<typeof readPlaceResolver>;
	newestCouncilRelease: string;
	councilNames: Map<string, string>;
	polygonsOf: (
		identity: { geography: string; boundaryRelease: string; code: string },
		tier: "high" | "medium" | "low",
	) => number[][][][] | undefined;
	mapsSlugByName: Map<string, string>;
	outputs: Map<string, string>;
	index: Pick<PlaceIndex, "areas" | "named" | "releases">;
}) {
	const currentCouncils =
		resolver.areaCodes("localAuthority", newestCouncilRelease) ?? [];

	type NamedLocation = {
		id: string;
		label: string;
		kind: string;
		source: Record<string, string>;
		memberGeography: string;
		memberAssertions: {
			code: string;
			validity: { from: string | null; to: string | null };
		}[];
	};
	const namedLocations = resolver.namedLocations() as NamedLocation[];
	const membersOf = (location: NamedLocation) =>
		location.memberAssertions ?? [];
	const COUNTRY_PREFIX: Record<string, string> = {
		england: "E",
		wales: "W",
		scotland: "S",
		"northern-ireland": "N",
		"united-kingdom": "",
	};
	const sourceText = (location: NamedLocation) => {
		const { source } = location;
		if (location.kind === "editorial-grouping")
			return "A grouping curated by the UK Data Atlas, with no official status.";
		if (location.kind === "country")
			return location.id === "united-kingdom"
				? "Every local authority in England, Wales, Scotland and Northern Ireland."
				: "One of the UK's four nations. Its local authorities are those whose codes start with its letter.";
		if (source.publisher === "Ordnance Survey")
			return `Its boundary comes from Ordnance Survey${source.edition ? `'s ${source.edition} edition of` : ""} Boundary-Line, and each local authority counts as a member of the county holding most of its area. It has no official code.`;
		return `Defined by the ${source.publisher ?? "Office for National Statistics"}${source.code ? `, which gives it the code ${source.code}` : ""}.`;
	};

	const memberSets = new Map<string, Set<string>>();
	for (const location of namedLocations) {
		const prefix = COUNTRY_PREFIX[location.id];
		const members =
			location.kind === "country" && prefix !== undefined
				? currentCouncils.filter((code) => code.startsWith(prefix))
				: membersOf(location)
						.filter((assertion) => assertion.validity.to === null)
						.map((assertion) => assertion.code);
		memberSets.set(location.id, new Set(members));
	}
	// One named place contains another when every current member of the second
	// is a member of the first, and it has more of them.
	const containsAll = (outer: string, inner: string) => {
		const a = memberSets.get(outer)!;
		const b = memberSets.get(inner)!;
		return (
			b.size > 1 && a.size > b.size && [...b].every((code) => a.has(code))
		);
	};

	for (const location of namedLocations) {
		const current = memberSets.get(location.id)!;
		const members =
			location.kind === "country"
				? [...current].map((code) => ({
						code,
						name: councilNames.get(code) ?? code,
						from: null,
						to: null,
						current: true,
					}))
				: membersOf(location).map((assertion) => ({
						code: assertion.code,
						name:
							councilNames.get(assertion.code) ?? assertion.code,
						from: assertion.validity.from,
						to: assertion.validity.to,
						current: assertion.validity.to === null,
					}));
		const shapes = new Map<string, number[][][][]>();
		for (const code of current) {
			const polygons = polygonsOf(
				{
					geography: "localAuthority",
					boundaryRelease: newestCouncilRelease,
					code,
				},
				current.size > 40 ? "low" : "medium",
			);
			if (polygons) shapes.set(code, polygons);
		}
		const outlines: Record<string, Outline> = Object.fromEntries(
			[...shapes].map(([code, polygons]) => [
				code,
				encodeOutline(polygons),
			]),
		);
		const others = namedLocations.filter(
			(other) => other.id !== location.id,
		);
		const profile: NamedProfile = {
			type: "named",
			id: location.id,
			label: location.label,
			kind: location.kind,
			source: sourceText(location),
			memberGeography: location.memberGeography,
			members: members.sort(
				(a, b) =>
					Number(b.current) - Number(a.current) ||
					a.name.localeCompare(b.name),
			),
			within: others
				.filter((other) => containsAll(other.id, location.id))
				.map(namedRef),
			contains: others
				.filter((other) => containsAll(location.id, other.id))
				.map(namedRef),
			bbox: boundsOf([...shapes.values()]),
			outlines,
			...(mapsSlugByName.has(location.label)
				? { mapsSlug: mapsSlugByName.get(location.label) }
				: {}),
		};
		outputs.set(`named/${location.id}.json`, JSON.stringify(profile));
		// Named places are not dated by release, so the years are left at zero.
		index.named.push([
			location.id,
			location.label,
			location.kind,
			null,
			0,
			null,
		]);
	}
}
