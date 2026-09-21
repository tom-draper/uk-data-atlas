import {
	formatPeriod,
	geographyIds,
	loadCatalogue,
	nationList,
	periodRange,
	releasesForGeography,
	servedDatasetIds,
	sourceSummaries,
} from "@/lib/docs/catalogue";
import { BOUNDARY_CATALOG } from "@/lib/data/boundaries/catalog";
import { DATA_PAGES, DATA_TOPICS } from "@/lib/docs/content/data";
import { GEOGRAPHIES, GEOGRAPHY_GROUPS } from "@/lib/docs/content/geographies";
import {
	combining,
	dataPageFacts,
	dataPagesOnGeography,
} from "@/lib/docs/dataPages";

const catalogue = loadCatalogue();

describe("data pages", () => {
	it("put every served dataset on exactly one page", () => {
		const placed = DATA_PAGES.flatMap((page) => page.datasets);
		expect(new Set(placed).size).toBe(placed.length);
		expect([...placed].sort()).toEqual(servedDatasetIds(catalogue).sort());
	});

	it("each belong to a topic, with a unique slug", () => {
		const topics = new Set(DATA_TOPICS.map((t) => t.id));
		for (const page of DATA_PAGES) expect(topics).toContain(page.topic);
		const slugs = DATA_PAGES.map((p) => p.slug);
		expect(new Set(slugs).size).toBe(slugs.length);
	});

	it("span every year a period names", () => {
		const page = DATA_PAGES.find((p) => p.slug === "life-expectancy")!;
		expect(dataPageFacts(page, catalogue).years).toEqual({
			from: 2001,
			to: 2022,
		});
	});

	it("each have measures and somewhere they're published", () => {
		for (const page of DATA_PAGES) {
			const facts = dataPageFacts(page, catalogue);
			expect(facts.measures.length, page.slug).toBeGreaterThan(0);
			expect(facts.sources.length, page.slug).toBeGreaterThan(0);
		}
	});
});

describe("geography pages", () => {
	it("introduce every geography in the boundary registry, and nothing else", () => {
		expect(Object.keys(GEOGRAPHIES).sort()).toEqual(
			geographyIds(catalogue),
		);
	});

	it("lists every map boundary release in its geography documentation", () => {
		for (const [geography, family] of Object.entries(BOUNDARY_CATALOG)) {
			expect(
				releasesForGeography(catalogue, geography)
					.map(({ id }) => id)
					.sort(),
				geography,
			).toEqual(family.releases.map(({ id }) => id).sort());
		}
	});

	it("link every geography data is published on", () => {
		const published = new Set(
			catalogue.measures.flatMap((m) =>
				m.sources.map((s) => s.sourceGeography.type),
			),
		);
		for (const geography of published) {
			expect(GEOGRAPHIES[geography], geography).toBeDefined();
		}
	});

	it("each belong to a group, with a unique slug", () => {
		const groups = new Set(GEOGRAPHY_GROUPS.map((g) => g.id));
		const slugs = Object.values(GEOGRAPHIES).map((g) => g.slug);
		expect(new Set(slugs).size).toBe(slugs.length);
		for (const content of Object.values(GEOGRAPHIES)) {
			expect(groups).toContain(content.group);
		}
	});

	it("find the data published on a geography", () => {
		const pages = dataPagesOnGeography("lsoa", catalogue).map(
			({ page }) => page.slug,
		);
		expect(pages).toContain("deprivation");
	});
});

describe("catalogue helpers", () => {
	it("names nations in a readable list", () => {
		expect(nationList(["GB-WLS", "GB-ENG"])).toBe("England and Wales");
		expect(nationList(["GB-SCT", "GB-NIR", "GB-ENG", "GB-WLS"])).toBe("UK");
		expect(nationList(["GB-ENG", "GB-WLS", "GB-NIR"])).toBe(
			"England, Wales and Northern Ireland",
		);
	});

	it("describes a run of periods", () => {
		expect(periodRange(["2011", "2012", "2024"])).toBe("2011 to 2024");
		expect(periodRange(["2022"])).toBe("2022");
	});

	it("groups measures that share a published source", () => {
		const [crime] = sourceSummaries(catalogue, ["crime"]);
		expect(crime.geography).toBe("communitySafetyPartnership");
		expect(crime.measureIds.length).toBeGreaterThan(20);
	});

	it("says how a measure combines over areas", () => {
		const measure = (id: string) =>
			catalogue.measures.find((m) => m.id === id)!;
		expect(combining(measure("population-estimate"))).toBe("Adds up");
		expect(combining(measure("house-price-median"))).toBe("Not combined");
	});
});

describe("formatPeriod", () => {
	it("reads each published period form aloud", () => {
		expect(formatPeriod("year-ending-2026-03")).toBe("Year to March 2026");
		expect(formatPeriod("2026-04")).toBe("April 2026");
		expect(formatPeriod("2026-Q1")).toBe("January to March 2026");
		expect(formatPeriod("2025-H1")).toBe("January to June 2025");
		expect(formatPeriod("2001-2003")).toBe("2001–2003");
		expect(formatPeriod("2000-01")).toBe("2000-01");
		expect(formatPeriod("1996-97")).toBe("1996-97");
		expect(formatPeriod("2022")).toBe("2022");
	});
});
