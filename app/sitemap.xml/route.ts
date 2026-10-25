import { SITEMAPS } from "@/app/sitemaps/sitemap";
import { SITE_URL } from "@/lib/site";

/**
 * The sitemap index, at the address the single sitemap had, so a search
 * console that has it keeps finding every sitemap.
 */
export function GET() {
	const sitemaps = SITEMAPS.map(
		(id) =>
			`<sitemap><loc>${SITE_URL}/sitemaps/sitemap/${id}.xml</loc></sitemap>`,
	).join("");
	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemaps}</sitemapindex>`,
		{ headers: { "Content-Type": "application/xml" } },
	);
}
