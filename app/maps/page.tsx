import type { Metadata } from "next";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import { Card, Eyebrow, Sheet } from "@/components/docs/Page";
import {
	ATLAS_LOCATIONS,
	ATLAS_MAPS,
	type AtlasLocation,
	type AtlasMap,
	atlasLocationsFor,
	pageMetadata,
} from "@/lib/atlas/pages";
import { atlasMapSections } from "@/lib/atlas/mapSections";

export const metadata: Metadata = pageMetadata({
	subject: "Maps of the UK",
	description:
		"Interactive maps of elections, population, house prices, crime, deprivation, health and more for every UK nation, region and city.",
	path: "/maps",
});

const NATIONS = [
	{ name: "England", slug: "england", country: "GB-ENG" },
	{ name: "Scotland", slug: "scotland", country: "GB-SCT" },
	{ name: "Wales", slug: "wales", country: "GB-WLS" },
	{ name: "Northern Ireland", slug: "northern-ireland", country: "GB-NIR" },
] as const;

const linkClass =
	"underline decoration-slate-300 underline-offset-[3px] hover:decoration-slate-700";

const WIDEST_FIRST = [
	"united-kingdom",
	...NATIONS.map((nation) => nation.slug),
];

/** The widest place a map covers: the UK, or else its one nation. */
function widestLocation(map: AtlasMap): AtlasLocation {
	const covered = atlasLocationsFor(map);
	return WIDEST_FIRST.map((slug) =>
		covered.find((location) => location.slug === slug),
	).find((location) => location !== undefined)!;
}

export default function MapsIndexPage() {
	return (
		<div className="min-h-screen bg-[#f3f3f1] text-slate-700">
			<Navigation />
			<main className="mx-auto max-w-[1480px] px-3 sm:px-4">
				<Sheet>
					<div className="max-w-[760px]">
						<Eyebrow>Maps</Eyebrow>
						<h1 className="text-[32px] leading-[1.15] font-semibold tracking-tight text-slate-900 sm:text-[38px]">
							Maps of the UK
						</h1>
						<p className="mt-4 text-[17px] leading-[1.7] text-slate-600">
							{ATLAS_MAPS.length} interactive maps of official
							data, from election results to house prices, for
							every nation, region and city in the atlas. Choose a
							place to see every map of it.
						</p>
					</div>

					<section className="mt-10">
						<h2 className="text-[24px] font-semibold tracking-tight text-slate-900">
							Places
						</h2>
						<div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
							{NATIONS.map((nation) => (
								<Card key={nation.name} className="p-5">
									<h3 className="text-[16px] font-semibold text-slate-900">
										<Link
											href={`/maps/${nation.slug}`}
											className={linkClass}
										>
											{nation.name}
										</Link>
									</h3>
									<ul className="mt-3 space-y-1 text-[14px] text-slate-600">
										{ATLAS_LOCATIONS.filter(
											(location) =>
												location.name !== nation.name &&
												location.countries.length ===
													1 &&
												location.countries[0] ===
													nation.country,
										).map((location) => (
											<li key={location.slug}>
												<Link
													href={`/maps/${location.slug}`}
													className={linkClass}
												>
													{location.name}
												</Link>
											</li>
										))}
									</ul>
								</Card>
							))}
						</div>
					</section>

					<section className="mt-12">
						<h2 className="text-[24px] font-semibold tracking-tight text-slate-900">
							Every map
						</h2>
						<div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
							{atlasMapSections(ATLAS_MAPS).map((section) => (
								<Card key={section.title} className="p-5">
									<h3 className="text-[16px] font-semibold text-slate-900">
										{section.title}
									</h3>
									<ul className="mt-3 space-y-1 text-[14px] text-slate-600">
										{section.maps.map((map) => {
											const location =
												widestLocation(map);
											return (
												<li key={map.slug}>
													<Link
														href={`/atlas/${location.slug}/${map.slug}`}
														className={linkClass}
													>
														{map.name}
													</Link>{" "}
													<span className="text-slate-400">
														{location.name}
													</span>
												</li>
											);
										})}
									</ul>
								</Card>
							))}
						</div>
					</section>
				</Sheet>
			</main>
		</div>
	);
}
