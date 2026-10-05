import type { MetadataRoute } from "next";
import { readingOrder } from "@/lib/docs/navigation";
import { loadApiContract } from "@/lib/docs/openapi";
import { ATLAS_LOCATIONS, atlasMapsFor } from "@/lib/atlas/pages";
import { RANKING_PAGES } from "@/lib/atlas/rankingPages";
import { PLACE_INDEX } from "@/lib/places/load";
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

/** The places index, and a page for every place in it. */
function placeEntries(): MetadataRoute.Sitemap {
	return [
		{
			url: `${SITE_URL}/places`,
			changeFrequency: "monthly" as const,
			priority: 0.8,
		},
		...[...PLACE_INDEX.named, ...PLACE_INDEX.areas].map(
			([id, , kind, , , lastYear]) => ({
				url: `${SITE_URL}/places/${id}`,
				changeFrequency: "monthly" as const,
				// Current councils and named places lead; wards and areas no
				// longer in use are many and narrow.
				priority: lastYear !== null ? 0.3 : kind === "ward" ? 0.4 : 0.6,
			}),
		),
	];
}

export default function sitemap(): MetadataRoute.Sitemap {
	return [
		{
			url: SITE_URL,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 1,
		},
		{
			url: `${SITE_URL}/atlas`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.9,
		},
		{
			url: `${SITE_URL}/datasets`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.6,
		},
		{
			url: `${SITE_URL}/geographies`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.6,
		},
		...mapEntries(),
		...placeEntries(),
		...docsEntries(),
	];
}
