import {
	atlasMapTitle,
	findAtlasLocation,
	findAtlasMap,
	locationLabel,
} from "@/lib/atlas/pages";
import { SHARE_CARD_SIZE, shareCard } from "@/lib/atlas/shareCard";
import { atlasMapFigure } from "@/lib/atlas/snippets";

export const size = SHARE_CARD_SIZE;
export const contentType = "image/png";

type Params = Promise<{ location: string; map: string }>;

async function resolve(params: Params) {
	const slugs = await params;
	const location = findAtlasLocation(slugs.location);
	const map = findAtlasMap(slugs.map);
	return location && map
		? {
				location,
				map,
				title: `${atlasMapTitle(map)} in ${locationLabel(location)}, ranked`,
			}
		: null;
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
		detail: atlasMapFigure(page.location, page.map),
		footer: `${page.map.source.source} · ukdataatlas.com`,
	});
}
