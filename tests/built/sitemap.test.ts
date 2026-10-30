import { describe, expect, it } from "vitest";
import sitemap, { generateSitemaps } from "@/app/sitemaps/sitemap";
import robots from "@/app/robots";
import { GET } from "@/app/sitemap.xml/route";
import { SITE_URL } from "@/lib/site";

const sitemaps = await Promise.all(
	(await generateSitemaps()).map(async ({ id }) => ({
		id,
		entries: await sitemap({ id: Promise.resolve(id) }),
	})),
);
const sitemapIndex = [
	...(await GET().text()).matchAll(/<loc>([^<]+)<\/loc>/g),
].map((match) => match[1]);
const entries = sitemaps.flatMap((part) => part.entries);
const paths = entries.map((entry) => new URL(entry.url).pathname);

describe("sitemap", () => {
	it("publishes canonical browse, map, ranking, place and current docs pages", () => {
		expect(paths).toEqual(
			expect.arrayContaining([
				"/",
				"/atlas",
				"/datasets",
				"/boundaries",
				"/maps",
				"/maps/england",
				"/atlas/england/adult-social-care-activity",
				"/maps/england/adult-social-care-activity",
				"/places",
				"/places/aberdeen",
				"/places/E08000003",
				"/places/E05004705",
				"/places/E04001132",
				"/places/J01000046",
				"/docs/v1",
				"/docs/v1/datasets/population",
				"/docs/v1/boundaries/local-authorities",
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

	it("advertises each sitemap, every one within the URL limit", () => {
		expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`);
		expect(sitemapIndex).toEqual(
			sitemaps.map(({ id }) => `${SITE_URL}/sitemaps/sitemap/${id}.xml`),
		);
		for (const part of sitemaps) {
			expect(part.entries.length).toBeGreaterThan(0);
			expect(part.entries.length).toBeLessThanOrEqual(50_000);
		}
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
