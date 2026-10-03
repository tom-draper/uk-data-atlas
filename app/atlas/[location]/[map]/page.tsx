import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AtlasClient from "@/components/AtlasClient";
import LoadingDisplay from "@/components/displays/LoadingDisplay";
import {
	atlasMapCovers,
	atlasPageDescription,
	atlasPageHeading,
	findAtlasLocation,
	findAtlasMap,
	pageTitle,
} from "@/lib/helpers/atlasPages";

type Params = Promise<{ location: string; map: string }>;

async function resolvePage(params: Params) {
	const slugs = await params;
	const location = findAtlasLocation(slugs.location);
	const map = findAtlasMap(slugs.map);
	if (!location || !map) notFound();
	return { location, map };
}

// Thousands of pages: each renders on its first visit and is cached.
export function generateStaticParams() {
	return [];
}

export async function generateMetadata({
	params,
}: {
	params: Params;
}): Promise<Metadata> {
	const { location, map } = await resolvePage(params);
	const title = pageTitle(atlasPageHeading(location, map));
	const description = atlasPageDescription(location, map);
	const path = `/atlas/${location.slug}/${map.slug}`;
	return {
		title,
		description,
		alternates: { canonical: path },
		openGraph: { title, description, url: path },
		twitter: { title, description },
		// The map renders anywhere, but only where its data reaches is it worth
		// a search result.
		...(atlasMapCovers(map, location)
			? {}
			: { robots: { index: false, follow: true } }),
	};
}

export default async function AtlasMapPage({ params }: { params: Params }) {
	const { location, map } = await resolvePage(params);
	return (
		<Suspense fallback={<LoadingDisplay />}>
			<AtlasClient page={{ location: location.slug, map: map.slug }} />
		</Suspense>
	);
}
