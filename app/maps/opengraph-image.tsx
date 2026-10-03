import { ATLAS_LOCATIONS, ATLAS_MAPS } from "@/lib/atlas/pages";
import { SHARE_CARD_SIZE, shareCard } from "@/lib/atlas/shareCard";

export const alt = "Maps of the UK";
export const size = SHARE_CARD_SIZE;
export const contentType = "image/png";

export default function Image() {
	return shareCard({
		title: "Maps of the UK",
		detail: `${ATLAS_MAPS.length} interactive maps of official data for ${ATLAS_LOCATIONS.length} places, from every nation to every council.`,
	});
}
