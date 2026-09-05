import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	BOUNDARY_CATALOG,
	BOUNDARY_TYPES,
} from "@/lib/data/boundaries/catalog";
import { parseDatasetMeta } from "@/lib/data/catalog/meta";

const ROOT = join(process.cwd(), "data", "boundaries");

/** Every file in a release folder, directories walked, meta.json excluded. */
const filesIn = (dir: string, prefix = ""): string[] =>
	readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory())
			return filesIn(path, `${prefix}${name}/`);
		return name === "meta.json" ? [] : [`${prefix}${name}`];
	});

const releaseFolders = readdirSync(ROOT).flatMap((geography) =>
	readdirSync(join(ROOT, geography)).map((release) => ({
		geography,
		release,
		dir: join(ROOT, geography, release),
	})),
);

/** The catalogue's BoundaryType for each geography folder. */
const GEOGRAPHY_TYPE: Record<string, string> = {
	ward: "ward",
	"local-authority": "localAuthority",
	constituency: "constituency",
	lsoa: "lsoa",
	"data-zone": "dataZone",
	"super-output-area": "superOutputArea",
};

describe("boundary release metadata", () => {
	it("describes every release folder on disk", () => {
		for (const { geography, release, dir } of releaseFolders) {
			const raw = readFileSync(join(dir, "meta.json"), "utf8");
			const meta = parseDatasetMeta(JSON.parse(raw), release);
			expect(meta.kind, `${geography}/${release}`).toBe("boundary");
			expect(
				meta.spatialCoverage?.geography,
				`${geography}/${release} geography`,
			).toBe(GEOGRAPHY_TYPE[geography]);
		}
	});

	// Drop a downloaded release in and this says what is missing, rather than
	// the files sitting there unlisted the way nine releases already had.
	it("lists exactly the files each release folder holds", () => {
		for (const { geography, release, dir } of releaseFolders) {
			const meta = parseDatasetMeta(
				JSON.parse(readFileSync(join(dir, "meta.json"), "utf8")),
				release,
			);
			const listed = new Set(meta.files.map((file) => file.path));
			const present = new Set(filesIn(dir));
			expect(
				[...present].filter((path) => !listed.has(path)),
				`${geography}/${release}: files not listed in meta.json`,
			).toEqual([]);
			expect(
				[...listed].filter((path) => !present.has(path)),
				`${geography}/${release}: meta.json lists missing files`,
			).toEqual([]);
		}
	});

	it("describes every release the catalogue serves", () => {
		const described = new Set(
			releaseFolders.map(
				({ geography, release }) => `${geography}/${release}`,
			),
		);
		for (const type of BOUNDARY_TYPES) {
			for (const { id, asset } of BOUNDARY_CATALOG[type].releases) {
				if (!asset) continue;
				const folder = asset
					.split("?")[0]!
					.replace("/data/boundaries/", "");
				expect(described).toContain(
					folder.replace("/boundaries.topojson", ""),
				);
			}
		}
	});
});
