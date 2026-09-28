import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { Gazetteer } from "@/lib/data/gazetteer/gazetteer";
import type { Crosswalk, GazetteerCore } from "@/lib/data/gazetteer/types";
import { LOCATIONS } from "@/lib/data/locations";
import { OFFICIAL_PLACES } from "@/lib/data/gazetteer/places";

const PRECOMPILED = join(process.cwd(), "public", "data", "datasets");
const core = JSON.parse(
	readFileSync(join(PRECOMPILED, "gazetteer.core.json"), "utf8"),
) as GazetteerCore;
const crosswalk = JSON.parse(
	readFileSync(
		join(PRECOMPILED, "crosswalk.constituency-localAuthority.json"),
		"utf8",
	),
) as Crosswalk;

const g = new Gazetteer(core, {
	"constituency->localAuthority": crosswalk,
});

describe("Gazetteer named locations", () => {
	const official = (name: string) => OFFICIAL_PLACES[name]?.kind;

	it("keeps editorial locations exactly as curated in LOCATIONS", () => {
		for (const [name, loc] of Object.entries(LOCATIONS)) {
			if (official(name) && official(name) !== "country") continue;
			expect(g.namedLocation(name)?.kind).toBe(
				official(name) ?? "editorial",
			);
			expect(g.membersOf(name)).toEqual(loc.lad_codes);
			expect(g.boundsOf(name)).toEqual(loc.bounds);
		}
	});

	it("sources official areas from ONS, keeping curated superseded codes", () => {
		for (const [name, place] of Object.entries(OFFICIAL_PLACES)) {
			if (place.kind === "country") continue;
			const location = g.namedLocation(name)!;
			expect(location.kind).toBe(place.kind);
			expect(location.source).toEqual({
				lookup: place.lookup,
				code: place.code,
			});
			// Codes the curated list keeps for older boundary releases stay.
			for (const code of LOCATIONS[name]!.lad_codes)
				if (!g.get(code) || g.get(code)!.vintage < 2023)
					expect(location.memberCodes).toContain(code);
			const [w, s, e, n] = LOCATIONS[name]!.bounds;
			const [bw, bs, be, bn] = location.bbox;
			expect(bw <= w && bs <= s && be >= e && bn >= n).toBe(true);
		}
	});

	it("includes the councils the hand-kept regions had lost", () => {
		const includes = (name: string, code: string) =>
			expect(g.membersOf(name)).toContain(code);
		includes("South East", "E07000177"); // Cherwell
		includes("South East", "E07000181"); // West Oxfordshire
		includes("South East", "E07000229"); // Worthing
		includes("Yorkshire", "E06000012"); // North East Lincolnshire
		includes("Yorkshire", "E06000013"); // North Lincolnshire
		includes("South West", "E06000030"); // Swindon
		includes("West Midlands", "E07000198"); // Staffordshire Moorlands
	});
});

describe("Gazetteer entries and attributes", () => {
	it("resolves a known LAD by code with a sane area", () => {
		const manchester = g.get("E08000003");
		expect(manchester?.name).toBe("Manchester");
		expect(manchester?.level).toBe("localAuthority");
		// ~115 km^2 in m^2
		expect(g.areaM2("E08000003")).toBeGreaterThan(100_000_000);
		expect(g.areaM2("E08000003")).toBeLessThan(130_000_000);
	});

	it("resolves names, filtered by level", () => {
		const hits = g.resolveName("Manchester", "localAuthority");
		expect(hits.map((e) => e.code)).toContain("E08000003");
	});

	it("returns undefined for unknown codes", () => {
		expect(g.get("NOT_A_CODE")).toBeUndefined();
		expect(g.areaM2("NOT_A_CODE")).toBeUndefined();
	});
});

describe("Gazetteer hierarchy (LAD -> region)", () => {
	it("ancestors: a LAD rolls up to its region", () => {
		const anc = g.ancestors("E08000003").map((e) => e.code); // Manchester
		expect(anc).toContain("E12000002"); // North West
		expect(g.ancestors("E06000018").map((e) => e.code)).toContain(
			"E12000004", // Nottingham, East Midlands
		);
		expect(g.ancestors("E06000027").map((e) => e.code)).toContain(
			"E12000009", // Torbay, South West
		);
	});

	it("descendants: a region contains its member LADs", () => {
		const lads = g
			.descendants("E12000002", "localAuthority")
			.map((e) => e.code);
		expect(lads).toContain("E08000003");
		expect(
			g
				.descendants("E12000004", "localAuthority")
				.map((entry) => entry.code),
		).toContain("E06000018"); // Nottingham
	});

	it("resolveName finds a region by name", () => {
		expect(
			g.resolveName("North West", "region").map((e) => e.code),
		).toContain("E12000002");
	});
});

describe("Gazetteer conversions (crosswalk 4.4)", () => {
	it("overlaps: a constituency maps to weighted LADs summing to 1", () => {
		const cons = Object.keys(crosswalk);
		for (const c of cons.slice(0, 50)) {
			const targets = g.overlaps(c, "localAuthority");
			expect(targets.length).toBeGreaterThan(0);
			const sum = targets.reduce((s, t) => s + t.weight, 0);
			expect(sum).toBeCloseTo(1, 1);
		}
	});

	it("apportion: splitting a value across LADs preserves the total", () => {
		const c = Object.keys(crosswalk).find((k) => crosswalk[k].length > 2)!;
		const out = g.apportion(
			{ [c]: 1000 },
			"constituency",
			"localAuthority",
		);
		const total = Object.values(out).reduce((s, v) => s + v, 0);
		expect(total).toBeCloseTo(1000, 0);
		expect(Object.keys(out).length).toBeGreaterThan(1);
	});
});
