import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	BOUNDARY_CATALOG,
	BOUNDARY_TYPES,
} from "@/lib/data/boundaries/catalog";
import { decodeBoundaryData } from "@/lib/data/boundaries/decode";

const localBoundaryPath = (path: string) =>
	join(process.cwd(), "data", path.split("?")[0]!.replace(/^\/data\//, ""));

const catalogued = BOUNDARY_TYPES.flatMap((type) =>
	BOUNDARY_CATALOG[type].releases.map((release) => ({ type, release })),
);

describe("boundary releases", () => {
	it("names every asset after the release that owns it", () => {
		for (const { type, release } of catalogued) {
			if (!release.asset) continue;
			expect(
				release.asset,
				`${type}/${release.id} is served from another release's folder`,
			).toContain(`/${release.id}/boundaries.topojson`);
			expect(existsSync(localBoundaryPath(release.asset))).toBe(true);
		}
	});

	// The Dec 2020 ward and Dec 2015 constituency assets were both compiled
	// with every property stripped, because the geography's shared key list
	// never mentioned WD20CD and spelled pcon15cd in the wrong case. Nothing
	// could see it: the assets had the right number of features and the wrong
	// contents. Each release now declares its own keys, and this checks them
	// against the file rather than against the list they came from.
	it("serves features carrying the code and name each release declares", () => {
		for (const { type, release } of catalogued) {
			if (!release.asset) continue;
			const where = `${type}/${release.id}`;
			const boundaries = decodeBoundaryData(
				JSON.parse(
					readFileSync(localBoundaryPath(release.asset), "utf8"),
				),
			);
			expect(boundaries.features.length, where).toBeGreaterThan(0);

			const properties = boundaries.features[0]!.properties;
			expect(
				Object.keys(properties),
				`${where} has no properties`,
			).not.toHaveLength(0);
			expect(properties, where).toHaveProperty(release.codeKey);
			expect(properties, where).toHaveProperty(release.nameKey);
			if (release.parentCodeKey) {
				expect(properties, where).toHaveProperty(release.parentCodeKey);
			}
		}
		// Reads every compiled asset in the catalogue, ~120 MB of TopoJSON.
	}, 60_000);

	it("keeps each geography's code and name keys paired", () => {
		for (const type of BOUNDARY_TYPES) {
			const { code, name } = BOUNDARY_CATALOG[type].properties;
			expect(name, type).toHaveLength(code.length);
		}
	});

	it("orders releases newest first", () => {
		for (const type of BOUNDARY_TYPES) {
			const dates = BOUNDARY_CATALOG[type].releases.map(
				(release) => release.year * 100 + (release.month ?? 0),
			);
			expect(
				[...dates].sort((a, b) => b - a),
				type,
			).toEqual(dates);
		}
	});

	it("aliases only years onto releases that exist and are served", () => {
		for (const type of BOUNDARY_TYPES) {
			const { releases, vintages } = BOUNDARY_CATALOG[type];
			const served = new Set(releases.flatMap((r) => r.asset ?? []));
			for (const asset of Object.values(vintages)) {
				expect(served, type).toContain(asset);
			}
		}
	});
});
