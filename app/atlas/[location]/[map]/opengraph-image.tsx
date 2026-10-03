import {
	atlasPageHeading,
	findAtlasLocation,
	findAtlasMap,
} from "@/lib/atlas/pages";
import { atlasMapFigure } from "@/lib/atlas/snippets";
import { SHARE_CARD_SIZE, shareCard } from "@/lib/atlas/shareCard";

export const size = SHARE_CARD_SIZE;
export const contentType = "image/png";

export async function generateImageMetadata({
	params,
}: {
	params: Promise<{ location: string; map: string }>;
}) {
	const { location, map } = await params;
	const place = findAtlasLocation(location);
	const atlasMap = findAtlasMap(map);
	return [
		{
			id: "card",
			alt:
				place && atlasMap
					? atlasPageHeading(place, atlasMap)
					: "UK Data Atlas",
			size,
			contentType,
		},
	];
}

export default async function Image({
	params,
}: {
	params: Promise<{ location: string; map: string }>;
}) {
	const slugs = await params;
	const location = findAtlasLocation(slugs.location);
	const map = findAtlasMap(slugs.map);
	if (!location || !map) return shareCard({ title: "UK Data Atlas" });
	return shareCard({
		title: atlasPageHeading(location, map),
		detail: atlasMapFigure(location, map),
		footer: `${map.source.source} · ukdataatlas.com`,
	});
}
