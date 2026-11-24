import Link from "next/link";
import { Card } from "@/components/docs/Page";
import { rankingLinkClass } from "@/components/maps/RankingRowView";
import {
	type AtlasLocation,
	type AtlasMap,
	atlasMapTitle,
	locationLabel,
} from "@/lib/atlas/pages";
import { otherRankings, rankingsElsewhere } from "@/lib/atlas/rankingLinks";

function LinkList({
	links,
}: {
	links: readonly { href: string; label: string }[];
}) {
	return (
		<ul className="mt-3 grid gap-x-6 gap-y-1.5 text-[15px] sm:grid-cols-2 lg:grid-cols-3">
			{links.map((link) => (
				<li key={link.href}>
					<Link href={link.href} className={rankingLinkClass}>
						{link.label}
					</Link>
				</li>
			))}
		</ul>
	);
}

const headingClass = "text-[13px] font-semibold tracking-wide text-slate-500";

/**
 * Where a reader goes next: the same map ranked for the places around this
 * one, and the other maps ranked for this place.
 */
export function RankingLinks({
	location,
	map,
}: {
	location: AtlasLocation;
	map: AtlasMap;
}) {
	const { wider, narrower } = rankingsElsewhere(location, map);
	const elsewhere = [...wider, ...narrower].map((place) => ({
		href: `/maps/${place.slug}/${map.slug}`,
		label: locationLabel(place),
	}));
	const sections = otherRankings(location, map);
	if (elsewhere.length === 0 && sections.length === 0) return null;

	return (
		<section className="mt-9 grid max-w-[1180px] gap-4">
			{elsewhere.length > 0 && (
				<Card className="p-5">
					<h2 className={headingClass}>
						{atlasMapTitle(map)} elsewhere
					</h2>
					<LinkList links={elsewhere} />
				</Card>
			)}
			{sections.length > 0 && (
				<Card className="p-5">
					<h2 className={headingClass}>
						More rankings for {locationLabel(location)}
					</h2>
					{sections.map((section, index) => (
						<div
							key={section.title}
							className={index === 0 ? "mt-3" : "mt-5"}
						>
							<h3 className="text-[14px] font-medium text-slate-700">
								{section.title}
							</h3>
							<LinkList
								links={section.maps.map((other) => ({
									href: `/maps/${location.slug}/${other.slug}`,
									label: atlasMapTitle(other),
								}))}
							/>
						</div>
					))}
				</Card>
			)}
		</section>
	);
}
