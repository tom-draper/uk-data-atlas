import type { MetadataRoute } from "next";
import { readingOrder } from "@/lib/docs/navigation";
import { loadApiContract } from "@/lib/docs/openapi";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ukdataatlas.com";

/** Every page of the API docs. */
function docsEntries(): MetadataRoute.Sitemap {
	return readingOrder(loadApiContract()).map((link) => ({
		url: `${SITE_URL}${link.href}`,
		changeFrequency: "monthly" as const,
		// Endpoint pages are many and narrow; the written pages lead.
		priority: link.method ? 0.5 : 0.7,
	}));
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
			url: `${SITE_URL}/sources`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.6,
		},
		...docsEntries(),
	];
}
