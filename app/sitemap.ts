import type { MetadataRoute } from "next";
import { readingOrder } from "@/lib/docs/navigation";
import { loadApiContract } from "@/lib/docs/openapi";
import { ATLAS_LOCATIONS, atlasMapsFor } from "@/lib/atlas/pages";
import { SITE_URL } from "@/lib/atlas/structuredData";

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
			url: `${SITE_URL}/about`,
			lastModified: new Date(),
			changeFrequency: "yearly",
			priority: 0.5,
		},
		{
			url: `${SITE_URL}/datasets`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.6,
		},
		...mapEntries(),
		...docsEntries(),
	];
}
