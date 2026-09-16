import type { MetadataRoute } from "next";
import { docsIndexable } from "@/lib/docs/mode";
import { allOperations, loadApiContract } from "@/lib/docs/openapi";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ukdataatlas.com";

/** The API docs, listed only once they are public. */
function docsEntries(): MetadataRoute.Sitemap {
	if (!docsIndexable()) return [];
	const contract = loadApiContract();
	return [
		{
			url: `${SITE_URL}/docs`,
			changeFrequency: "weekly",
			priority: 0.8,
		},
		...contract.sections.map((section) => ({
			url: `${SITE_URL}/docs/${section.slug}`,
			changeFrequency: "weekly" as const,
			priority: 0.6,
		})),
		...allOperations(contract).map((op) => ({
			url: `${SITE_URL}/docs/${op.sectionSlug}/${op.slug}`,
			changeFrequency: "monthly" as const,
			priority: 0.5,
		})),
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
			url: `${SITE_URL}/sources`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.6,
		},
		...docsEntries(),
	];
}
