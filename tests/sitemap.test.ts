import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { SITE_URL } from "@/lib/site";

const entries = sitemap();
const paths = entries.map((entry) => new URL(entry.url).pathname);

describe("sitemap", () => {
	it("publishes canonical browse, map, ranking, place and current docs pages", () => {
		expect(paths).toEqual(
			expect.arrayContaining([
				"/",
				"/atlas",
				"/datasets",
				"/geographies",
				"/maps",
				"/maps/england",
				"/atlas/england/adult-social-care-activity",
				"/maps/england/adult-social-care-activity",
				"/places",
				"/places/aberdeen",
				"/places/E08000003",
				"/docs/v1",
				"/docs/v1/datasets/population",
				"/docs/v1/geographies/local-authorities",
				"/docs/v1/reference/map/measure-observations",
			]),
		);
	});

	it("omits redirects, noindex pages and maps outside their coverage", () => {
		for (const path of [
			"/about",
			"/sources",
			"/boundaries",
			"/docs",
			"/atlas/england",
			"/atlas/scotland/adult-social-care-activity",
		]) {
			expect(paths).not.toContain(path);
		}
		expect(paths.some((path) => path.startsWith("/docs/v1/data/"))).toBe(
			false,
		);
	});

	it("advertises unique absolute URLs within the single sitemap limit", () => {
		expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`);
		expect(entries.length).toBeGreaterThan(0);
		expect(entries.length).toBeLessThanOrEqual(50_000);
		expect(new Set(entries.map((entry) => entry.url)).size).toBe(
			entries.length,
		);
		expect(
			entries.every((entry) => {
				const url = new URL(entry.url);
				return (
					url.origin === new URL(SITE_URL).origin &&
					!url.search &&
					!url.hash
				);
			}),
		).toBe(true);
	});
});
