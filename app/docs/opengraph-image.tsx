import { SHARE_CARD_SIZE, shareCard } from "@/lib/atlas/shareCard";

export const alt = "UK Data Atlas API";
export const size = SHARE_CARD_SIZE;
export const contentType = "image/png";

export default function Image() {
	return shareCard({
		title: "UK Data Atlas API",
		detail: "Official UK statistics for every ward, council and constituency, with boundaries to map them.",
		footer: "ukdataatlas.com/docs",
	});
}
