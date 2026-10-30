import type { MetadataRoute } from "next";
import { readingOrder } from "@/lib/docs/navigation";
import { loadApiContract } from "@/lib/docs/openapi";
import { ATLAS_LOCATIONS, atlasMapsFor } from "@/lib/atlas/pages";
import { RANKING_PAGES } from "@/lib/atlas/rankingPages";
import { loadPlaceIndex } from "@/lib/places/load";
import { SITE_URL } from "@/lib/site";

/** Every page of the API docs. */
function docsEntries(): MetadataRoute.Sitemap {
	return readingOrder(loadApiContract()).map((link) => ({
		url: `${SITE_URL}${link.href}`,
		changeFrequency: "monthly" as const,
		// Endpoint pages are many and narrow; the written pages lead.
		priority: link.method ? 0.5 : 0.7,
	}));
}

/** The browse pages, and each map's page where its data reaches. */
function mapEntries(): MetadataRoute.Sitemap {
	return [
		{
			url: `${SITE_URL}/maps`,
			changeFrequency: "monthly" as const,
			priority: 0.8,
		},
		...ATLAS_LOCATIONS.flatMap((location) => [
			{
				url: `${SITE_URL}/maps/${location.slug}`,
				changeFrequency: "monthly" as const,
				priority: 0.7,
			},
			...atlasMapsFor(location).map((map) => ({
				url: `${SITE_URL}/atlas/${location.slug}/${map.slug}`,
				changeFrequency: "monthly" as const,
				priority: 0.6,
			})),
		]),
		...RANKING_PAGES.map(({ location, map }) => ({
			url: `${SITE_URL}/maps/${location}/${map}`,
			changeFrequency: "monthly" as const,
			priority: 0.6,
		})),
	];
}

/**
 * The sitemaps, each within Google's 50,000 URL limit: the site's own pages
 * with its councils, constituencies, towns and named places, then the many
 * narrow places in sitemaps of their own.
 */
export const SITEMAPS = ["site", "wards", "parishes", "former"] as const;

type SitemapId = (typeof SITEMAPS)[number];

/** Which sitemap an area's page is in. */
const sitemapOf = (kind: string, lastYear: number | null): SitemapId =>
	lastYear !== null
		? "former"
		: kind === "ward"
			? "wards"
			: kind === "parish"
				? "parishes"
				: "site";

/** The places in one sitemap, and the places index in the site's own. */
async function placeEntries(id: SitemapId): Promise<MetadataRoute.Sitemap> {
	const PLACE_INDEX = await loadPlaceIndex();
	return [
		...(id === "site"
			? [
					{
						url: `${SITE_URL}/places`,
						changeFrequency: "monthly" as const,
						priority: 0.8,
					},
				]
			: []),
		...[...PLACE_INDEX.named, ...PLACE_INDEX.areas]
			.filter(
				([, , kind, , , lastYear]) => sitemapOf(kind, lastYear) === id,
			)
			.map(([place, , , , , lastYear]) => ({
				url: `${SITE_URL}/places/${place}`,
				changeFrequency: "monthly" as const,
				// Current councils and named places lead; wards, parishes and
				// areas no longer in use are many and narrow.
				priority: lastYear !== null ? 0.3 : id === "site" ? 0.6 : 0.4,
			})),
	];
}

export async function generateSitemaps() {
	return SITEMAPS.map((id) => ({ id }));
}

export default async function sitemap(props: {
	id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
	const id = (await props.id) as SitemapId;
	if (id !== "site") return placeEntries(id);
	return [
		{
			url: SITE_URL,
			changeFrequency: "monthly",
			priority: 1,
		},
		{
			url: `${SITE_URL}/atlas`,
			changeFrequency: "monthly",
			priority: 0.9,
		},
		{
			url: `${SITE_URL}/datasets`,
			changeFrequency: "monthly",
			priority: 0.6,
		},
		{
			url: `${SITE_URL}/boundaries`,
			changeFrequency: "monthly",
			priority: 0.6,
		},
		...mapEntries(),
		...(await placeEntries("site")),
		...docsEntries(),
	];
}
