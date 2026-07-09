import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { Gazetteer } from "@/lib/data/gazetteer/gazetteer";
import type { Crosswalk, GazetteerCore } from "@/lib/data/gazetteer/types";
import { LOCATIONS } from "@/lib/data/locations";

const PRECOMPILED = join(process.cwd(), "data", "precompiled");
const core = JSON.parse(
	readFileSync(join(PRECOMPILED, "gazetteer.core.json"), "utf8"),
) as GazetteerCore;
const crosswalk = JSON.parse(
	readFileSync(join(PRECOMPILED, "crosswalk.constituency-localAuthority.json"), "utf8"),
) as Crosswalk;

const g = new Gazetteer(core);
g.registerCrosswalk("constituency", "localAuthority", crosswalk);

describe("Gazetteer core agrees with LOCATIONS (regression guard)", () => {
	it("membersOf matches LOCATIONS.lad_codes for every named location", () => {
		for (const [name, loc] of Object.entries(LOCATIONS)) {
			expect(g.membersOf(name)).toEqual(loc.lad_codes);
		}
	});

	it("boundsOf matches LOCATIONS.bounds for every named location", () => {
		for (const [name, loc] of Object.entries(LOCATIONS)) {
			expect(g.boundsOf(name)).toEqual(loc.bounds);
		}
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
	});

	it("descendants: a region contains its member LADs", () => {
		const lads = g.descendants("E12000002", "localAuthority").map((e) => e.code);
		expect(lads).toContain("E08000003");
	});

	it("resolveName finds a region by name", () => {
		expect(g.resolveName("North West", "region").map((e) => e.code)).toContain("E12000002");
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
		const out = g.apportion({ [c]: 1000 }, "constituency", "localAuthority");
		const total = Object.values(out).reduce((s, v) => s + v, 0);
		expect(total).toBeCloseTo(1000, 0);
		expect(Object.keys(out).length).toBeGreaterThan(1);
	});
});
