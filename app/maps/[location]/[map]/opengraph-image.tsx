import { findAtlasLocation, locationLabel } from "@/lib/atlas/pages";
import { findRanking, rankingTitle } from "@/lib/atlas/rankings";
import { SHARE_CARD_SIZE, shareCard } from "@/lib/atlas/shareCard";
import { atlasMapFigure } from "@/lib/atlas/snippets";

export const size = SHARE_CARD_SIZE;
export const contentType = "image/png";

type Params = Promise<{ location: string; map: string }>;

async function resolve(params: Params) {
	const slugs = await params;
	const location = findAtlasLocation(slugs.location);
	const ranking = findRanking(slugs.map);
	if (!location || !ranking) return null;
	const { map, period } = ranking;
	return {
		location,
		map,
		// The map's figure is of its latest period.
		latest: period === map.periods[0],
		title: `${rankingTitle(map, period)} in ${locationLabel(location)}, ranked`,
	};
}

export async function generateImageMetadata({ params }: { params: Params }) {
	const page = await resolve(params);
	return [
		{ id: "card", alt: page?.title ?? "UK Data Atlas", size, contentType },
	];
}

export default async function Image({ params }: { params: Params }) {
	const page = await resolve(params);
	if (!page) return shareCard({ title: "UK Data Atlas" });
	return shareCard({
		title: page.title,
		detail: page.latest
			? atlasMapFigure(page.location, page.map)
			: undefined,
		footer: `${page.map.source.source} · ukdataatlas.com`,
	});
}
