import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AtlasClient from "@/components/AtlasClient";
import LoadingDisplay from "@/components/displays/LoadingDisplay";
import {
	atlasMapCovers,
	atlasPageHeading,
	findAtlasLocation,
	findAtlasMap,
	pageMetadata,
} from "@/lib/atlas/pages";
import { atlasMapSnippet } from "@/lib/atlas/snippets";
import { atlasMapJsonLd, JsonLd } from "@/lib/atlas/structuredData";

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
	return pageMetadata({
		subject: atlasPageHeading(location, map),
		description: atlasMapSnippet(location, map),
		path: `/atlas/${location.slug}/${map.slug}`,
		// The map renders anywhere, but only where its data reaches is it worth
		// a search result.
		robots: atlasMapCovers(map, location)
			? undefined
			: { index: false, follow: true },
	});
}

export default async function AtlasMapPage({ params }: { params: Params }) {
	const { location, map } = await resolvePage(params);
	return (
		<>
			<JsonLd data={atlasMapJsonLd(location, map)} />
			<Suspense fallback={<LoadingDisplay />}>
				<AtlasClient
					page={{ location: location.slug, map: map.slug }}
				/>
			</Suspense>
		</>
	);
}
