import { describe, expect, it } from "vitest";
import {
	type AtlasLocation,
	findAtlasLocation,
	findAtlasMap,
} from "@/lib/atlas/pages";
import {
	covers,
	otherRankings,
	rankingsElsewhere,
} from "@/lib/atlas/rankingLinks";
import { hasRankingFor } from "@/lib/atlas/rankingPages";

const place = (
	slug: string,
	members: string[],
	countries: AtlasLocation["countries"] = ["GB-ENG"],
): AtlasLocation => ({
	name: slug,
	slug,
	countries,
	members,
	kind: "editorial",
});

describe("which places cover which", () => {
	const england = place("england", []);
	const uk = place("uk", [], ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"]);
	const region = place("region", ["A", "B", "C"]);
	const city = place("city", ["A"]);
	const welsh = place("welsh", ["W"], ["GB-WLS"]);

	it("lets a nation cover the places in it", () => {
		expect(covers(england, city)).toBe(true);
		expect(covers(england, welsh)).toBe(false);
		expect(covers(uk, england)).toBe(true);
		expect(covers(england, uk)).toBe(false);
		expect(covers(england, england)).toBe(false);
	});

	it("covers a place only with more of the same councils", () => {
		expect(covers(region, city)).toBe(true);
		expect(covers(city, region)).toBe(false);
		expect(covers(city, place("same", ["A"]))).toBe(false);
		expect(covers(region, place("across", ["A", "Z"]))).toBe(false);
	});
});

describe("ranking page links", () => {
	const map = findAtlasMap("house-price")!;

	it("links a borough's ranking to the places covering it, widest first", () => {
		const camden = findAtlasLocation("camden")!;
		const { wider } = rankingsElsewhere(camden, map);
		const expected = ["england", "london"].filter((slug) =>
			hasRankingFor(slug, map.slug),
		);
		expect(expected).toContain("london");
		expect(wider.map((other) => other.slug)).toEqual(expected);
	});

	it("links a nation's ranking to its places, biggest first and not hundreds", () => {
		const { narrower } = rankingsElsewhere(
			findAtlasLocation("england")!,
			map,
		);
		expect(narrower.length).toBeLessThanOrEqual(12);
		const sizes = narrower.map((other) => other.members.length);
		expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
	});

	it("lists every other map ranked for the place, not this one", () => {
		const london = findAtlasLocation("london")!;
		const maps = otherRankings(london, map).flatMap(
			(section) => section.maps,
		);
		expect(maps.length).toBeGreaterThan(0);
		expect(maps.map((other) => other.slug)).not.toContain(map.slug);
		for (const other of maps)
			expect(hasRankingFor("london", other.slug)).toBe(true);
	});
});
