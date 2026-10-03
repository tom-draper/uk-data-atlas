import {
	atlasMapsFor,
	findAtlasLocation,
	locationLabel,
} from "@/lib/atlas/pages";
import { SHARE_CARD_SIZE, shareCard } from "@/lib/atlas/shareCard";

export const size = SHARE_CARD_SIZE;
export const contentType = "image/png";

type Params = Promise<{ location: string }>;

export async function generateImageMetadata({ params }: { params: Params }) {
	const location = findAtlasLocation((await params).location);
	return [
		{
			id: "card",
			alt: location
				? `Maps of ${locationLabel(location)}`
				: "UK Data Atlas",
			size,
			contentType,
		},
	];
}

export default async function Image({ params }: { params: Params }) {
	const location = findAtlasLocation((await params).location);
	if (!location) return shareCard({ title: "UK Data Atlas" });
	return shareCard({
		title: `Maps of ${locationLabel(location)}`,
		detail: `${atlasMapsFor(location).length} interactive maps of official data: elections, population, house prices, crime, health and more.`,
	});
}
