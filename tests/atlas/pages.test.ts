import { describe, expect, it } from "vitest";
import {
	ATLAS_LOCATIONS,
	ATLAS_MAPS,
	atlasHref,
	atlasInitialState,
	atlasLocationsFor,
	atlasMapsFor,
	atlasPageHeading,
	atlasVizFor,
	DEFAULT_ACTIVE_VIZ,
	DEFAULT_LOCATION,
	findAtlasLocation,
	findAtlasMap,
	legacyAtlasHref,
	MAP_NAMES,
} from "@/lib/atlas/pages";
import gazetteerCore from "@/public/data/datasets/gazetteer.core.json";
import { gazetteer } from "@/lib/data/gazetteer/static";
import type { GazetteerCore } from "@/lib/data/gazetteer/types";

const location = (slug: string) => findAtlasLocation(slug)!;
const map = (slug: string) => findAtlasMap(slug)!;

/** The selection a page URL opens with, as the route and hook read it. */
function stateAt(href: string) {
	const url = new URL(href, "https://example.test");
	const [, , locationSlug, mapSlug] = url.pathname.split("/");
	return atlasInitialState(
		{ location: locationSlug, map: mapSlug },
		url.searchParams.get("period"),
	);
}

describe("atlas pages", () => {
	it("gives every map and location a unique hyphenated slug", () => {
		for (const items of [ATLAS_MAPS, ATLAS_LOCATIONS]) {
			const slugs = items.map((item) => item.slug);
			expect(new Set(slugs).size).toBe(slugs.length);
			for (const slug of slugs)
				expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
		}
	});

	it("names every map, and only maps that exist", () => {
		expect(Object.keys(MAP_NAMES).sort()).toEqual(
			ATLAS_MAPS.map((atlasMap) => atlasMap.slug).sort(),
		);
	});

	it("gives every map and every location at least one page", () => {
		for (const atlasMap of ATLAS_MAPS)
			expect(atlasLocationsFor(atlasMap), atlasMap.slug).not.toHaveLength(
				0,
			);
		for (const atlasLocation of ATLAS_LOCATIONS)
			expect(
				atlasMapsFor(atlasLocation),
				atlasLocation.slug,
			).not.toHaveLength(0);
	});

	it("gives every current local authority a place", () => {
		const entries = Object.values(
			(gazetteerCore as unknown as GazetteerCore).byCode,
		).filter((entry) => entry.level === "localAuthority");
		const current = Math.max(...entries.map((entry) => entry.vintage));
		const names = new Set(ATLAS_LOCATIONS.map((place) => place.name));
		const single = new Set(
			ATLAS_LOCATIONS.filter((place) => place.members.length === 1).map(
				(place) => place.members[0],
			),
		);
		const missing = entries.filter(
			(entry) =>
				entry.vintage === current &&
				!single.has(entry.code) &&
				!names.has(entry.name.replace(/, (City|County) of$/, "")),
		);
		expect(missing.map((entry) => entry.name)).toEqual([]);
		// A council opens the atlas like any other place.
		expect(gazetteer.boundsOf("Rutland")).toBeDefined();
		expect(gazetteer.membersOf("Rutland")).toHaveLength(1);
	});

	it("keeps maps to the nations their data covers", () => {
		const glasgow = atlasMapsFor(location("glasgow")).map((m) => m.slug);
		expect(glasgow).toContain("simd");
		expect(glasgow).not.toContain("imd");
		expect(glasgow).not.toContain("population-density");
		const uk = atlasMapsFor(location("united-kingdom")).map((m) => m.slug);
		expect(uk).toContain("general-election");
		expect(uk).not.toContain("imd");
	});

	it("titles a page by what it maps and where", () => {
		expect(
			atlasPageHeading(location("london"), map("population-density")),
		).toBe("Population Density in London");
		expect(
			atlasPageHeading(location("london"), map("general-election"), 2019),
		).toBe("2019 General Election Results in London");
		expect(
			atlasPageHeading(location("united-kingdom"), map("brexit")),
		).toBe("EU Referendum Results in the United Kingdom");
	});

	it("round-trips every map and period through its URL", () => {
		const london = location("london");
		for (const atlasMap of ATLAS_MAPS) {
			for (const period of atlasMap.periods) {
				const viz = atlasVizFor(atlasMap, period);
				const href = atlasHref(london.name, viz);
				expect(href.startsWith(`/atlas/london/${atlasMap.slug}`)).toBe(
					true,
				);
				expect(href.includes("?period=")).toBe(
					period !== atlasMap.periods[0],
				);
				expect(stateAt(href)).toEqual({
					activeViz: viz,
					selectedLocation: "London",
				});
			}
		}
	});

	it("opens on the defaults without a page, and on the newest period without a valid one", () => {
		expect(atlasInitialState({}, null)).toEqual({
			activeViz: DEFAULT_ACTIVE_VIZ,
			selectedLocation: DEFAULT_LOCATION,
		});
		for (const period of [null, "1999", "not-a-year"])
			expect(
				atlasInitialState(
					{ location: "leeds", map: "general-election" },
					period,
				).activeViz.datasetYear,
			).toBe(2024);
	});

	it("moves links from before each map had a page", () => {
		expect(legacyAtlasHref(new URLSearchParams())).toBeNull();
		expect(legacyAtlasHref(new URLSearchParams("demo=true"))).toBeNull();
		expect(
			legacyAtlasHref(
				new URLSearchParams(
					"location=North%20Wales&dataset=population&period=2022&view=age",
				),
			),
		).toBe("/atlas/north-wales/population-age");
		expect(
			legacyAtlasHref(
				new URLSearchParams(
					"location=London&dataset=general-election&period=2017",
				),
			),
		).toBe("/atlas/london/general-election?period=2017");
		// A population link with no view opens the dataset's primary chart.
		expect(
			legacyAtlasHref(
				new URLSearchParams(
					"location=London&dataset=population&period=2022",
				),
			),
		).toBe("/atlas/london/population-density");
		expect(
			legacyAtlasHref(
				new URLSearchParams("dataset=population&period=not-a-year"),
			),
		).toBe("/atlas/greater-manchester/local-election?period=2024");
		expect(legacyAtlasHref(new URLSearchParams("location=Atlantis"))).toBe(
			"/atlas",
		);
	});
});
