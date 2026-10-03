import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navigation from "@/components/Navigation";
import { Breadcrumbs, Card, Sheet } from "@/components/docs/Page";
import {
	atlasMapTitle,
	findAtlasLocation,
	findAtlasMap,
	locationLabel,
} from "@/lib/atlas/pages";
import { hasRankingFor, loadRanking } from "@/lib/atlas/rankingPages";
import {
	areasWithin,
	COUNCIL_PLACES,
	formatRankedValue,
	rankedValueLabel,
} from "@/lib/atlas/rankings";
import { atlasMapFigure } from "@/lib/atlas/snippets";
import { JsonLd, rankingJsonLd } from "@/lib/atlas/structuredData";
import { gazetteer } from "@/lib/data/gazetteer/static";
import { pageMetadata } from "@/lib/site";

type Params = Promise<{ location: string; map: string }>;

// Over a thousand pages: each renders on its first visit and is cached.
export function generateStaticParams() {
	return [];
}

const titleCase = (text: string) =>
	text.replace(/\b\w/g, (letter) => letter.toUpperCase());

const AREA_PLURALS: Readonly<Record<string, string>> = {
	ward: "wards",
	"local authority": "local authorities",
};

async function resolvePage(params: Params) {
	const slugs = await params;
	const location = findAtlasLocation(slugs.location);
	const map = findAtlasMap(slugs.map);
	if (!location || !map || !hasRankingFor(location.slug, map.slug))
		notFound();
	const areas = areasWithin(await loadRanking(map.slug), location);
	const plural = AREA_PLURALS[map.areaNoun] ?? `${map.areaNoun}s`;
	const subject = `${atlasMapTitle(map)} in ${locationLabel(location)}: ${titleCase(plural)} Ranked`;
	return { location, map, areas, plural, subject };
}

export async function generateMetadata({
	params,
}: {
	params: Params;
}): Promise<Metadata> {
	const { location, map, areas, plural, subject } = await resolvePage(params);
	const figure = atlasMapFigure(location, map);
	const lead = `All ${areas.length} ${plural} in ${locationLabel(location)} ranked by ${rankedValueLabel(map).toLowerCase()}, from ${areas[0].name} to ${areas.at(-1)!.name}.`;
	return pageMetadata({
		// This segment has its own opengraph-image.
		image: null,
		subject,
		description: figure ? `${figure} ${lead}` : lead,
		path: `/maps/${location.slug}/${map.slug}`,
	});
}

const linkClass =
	"underline decoration-slate-300 underline-offset-[3px] hover:decoration-slate-700";

export default async function RankingPage({ params }: { params: Params }) {
	const { location, map, areas, plural, subject } = await resolvePage(params);
	const figure = atlasMapFigure(location, map);
	const wards = map.areaNoun === "ward";
	const heading = subject.split(": ");

	return (
		<div className="min-h-screen bg-[#f3f3f1] text-slate-700">
			<JsonLd
				data={rankingJsonLd(location, map, subject, areas.length)}
			/>
			<Navigation />
			<main className="mx-auto max-w-[1480px] px-3 sm:px-4">
				<Sheet>
					<Breadcrumbs
						trail={[
							{ label: "Maps", href: "/maps" },
							{
								label: location.name,
								href: `/maps/${location.slug}`,
							},
							{ label: atlasMapTitle(map) },
						]}
					/>
					<div className="max-w-[760px]">
						<h1 className="text-[32px] leading-[1.15] font-semibold tracking-tight text-slate-900 sm:text-[38px]">
							{heading[0]}
							<span className="block text-slate-500">
								{heading[1]}
							</span>
						</h1>
						{figure && (
							<p className="mt-4 text-[17px] leading-[1.7] text-slate-700">
								{figure}
							</p>
						)}
						<p className="mt-3 text-[15px] leading-[1.7] text-slate-600">
							All {areas.length} {plural} in{" "}
							{locationLabel(location)}, ranked by{" "}
							{rankedValueLabel(map).toLowerCase()}. Data:{" "}
							<a
								href={map.source.sourceUrl}
								target="_blank"
								rel="noopener noreferrer"
								className={linkClass}
							>
								{map.source.source}
							</a>{" "}
							({map.source.year}),{" "}
							<a
								href={map.source.licenceUrl}
								target="_blank"
								rel="noopener noreferrer"
								className={linkClass}
							>
								{map.source.licence}
							</a>
							.
						</p>
						<Link
							href={`/atlas/${location.slug}/${map.slug}`}
							className="mt-6 inline-flex items-center rounded-md bg-slate-900 px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-slate-800"
						>
							Open the interactive map
						</Link>
					</div>

					<Card className="mt-9 max-w-[900px] overflow-hidden">
						<div className="overflow-x-auto">
							<table className="w-full text-left text-[14px]">
								<thead>
									<tr className="border-b border-slate-900/[0.07] text-[12px] font-semibold tracking-wide text-slate-500">
										<th className="w-16 px-4 py-3">Rank</th>
										<th className="px-4 py-3">
											{wards ? "Ward" : "Local authority"}
										</th>
										<th className="px-4 py-3 text-right">
											{rankedValueLabel(map)}
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-900/[0.05]">
									{areas.map((area, index) => {
										const council = COUNCIL_PLACES.get(
											area.district,
										);
										return (
											<tr
												key={area.code}
												className="hover:bg-white/60"
											>
												<td className="px-4 py-2 tabular-nums text-slate-500">
													{index + 1}
												</td>
												<td className="px-4 py-2 font-medium text-slate-900">
													{wards ? (
														<>
															{area.name}
															<span className="ml-2 font-normal text-slate-500">
																{council?.name ??
																	gazetteer.get(
																		area.district,
																	)?.name}
															</span>
														</>
													) : council ? (
														<Link
															href={`/maps/${council.slug}`}
															className={
																linkClass
															}
														>
															{area.name}
														</Link>
													) : (
														area.name
													)}
												</td>
												<td className="px-4 py-2 text-right tabular-nums">
													{formatRankedValue(
														map,
														area.value,
													)}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</Card>
				</Sheet>
			</main>
		</div>
	);
}
