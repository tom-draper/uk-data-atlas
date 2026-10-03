import { SHARE_CARD_SIZE, shareCard } from "@/lib/atlas/shareCard";

export const alt = "UK Data Atlas";
export const size = SHARE_CARD_SIZE;
export const contentType = "image/png";

export default function Image() {
	return shareCard({
		title: "Interactive maps of the data that shapes the UK",
		detail: "Elections, population, house prices, crime, deprivation, health and more, from official sources.",
	});
}
