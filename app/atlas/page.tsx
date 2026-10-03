import { Suspense } from "react";
import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import AtlasClient from "@/components/AtlasClient";
import LoadingDisplay from "@/components/displays/LoadingDisplay";
import { legacyAtlasHref } from "@/lib/atlas/pages";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
	subject: "Explore",
	description:
		"Explore interactive maps of UK elections, demographics, house prices, crime, income, ethnicity and more. Filter by region, council, ward or constituency.",
	path: "/atlas",
});

export default async function MapsPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	// Shared links from before each map had its own page.
	const query = new URLSearchParams();
	for (const [key, value] of Object.entries(await searchParams)) {
		const first = Array.isArray(value) ? value[0] : value;
		if (first !== undefined) query.set(key, first);
	}
	const href = legacyAtlasHref(query);
	if (href) permanentRedirect(href);

	return (
		<Suspense fallback={<LoadingDisplay />}>
			<AtlasClient />
		</Suspense>
	);
}
