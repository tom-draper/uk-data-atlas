import type { Metadata } from "next";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import { Breadcrumbs, Card, Sheet } from "@/components/docs/Page";
import { rankingLinkClass } from "@/components/maps/RankingRowView";
import RankingTable from "@/components/maps/RankingTable";
import {
	RankingSummary,
	summaryPositions,
} from "@/components/maps/RankingSummary";
import { atlasMapTitle, locationLabel } from "@/lib/atlas/pages";
import {
	barScale,
	isLongRanking,
	rankingRow,
	resolveRanking,
	SERVER_ROWS,
} from "@/lib/atlas/rankingRows";
import { LEVEL_NOUNS, rankedValueLabel } from "@/lib/atlas/rankings";
import { atlasMapFigure } from "@/lib/atlas/snippets";
import { JsonLd, rankingJsonLd } from "@/lib/atlas/structuredData";
import { pageMetadata, titleCase } from "@/lib/site";

type Params = Promise<{ location: string; map: string }>;

// Over a thousand pages: each renders on its first visit and is cached.
export function generateStaticParams() {
	return [];
}

/**
 * "Emissions per person (CO2e)" reads "emissions per person (CO2e)"; a label
 * led by a name, such as "White British residents", keeps its capitals.
 */
const midSentence = (label: string) =>
	/^[A-Z][a-z]* [^A-Z]/.test(label)
		? label[0]!.toLowerCase() + label.slice(1)
		: label;

/** The areas a ranking's structured data lists, from the top. */
const LEADERS = 10;

async function resolvePage(params: Params) {
	const resolved = await resolveRanking(await params);
	const { location, map, ranking } = resolved;
	const plural = LEVEL_NOUNS[ranking.level].many;
	const place = `${atlasMapTitle(map)} in ${locationLabel(location)}`;
	const subject = `${place}: ${titleCase(plural)} Ranked`;
	return { ...resolved, plural, subject, place };
}

export async function generateMetadata({
	params,
}: {
	params: Params;
}): Promise<Metadata> {
	const { location, map, areas, plural, place } = await resolvePage(params);
	const figure = atlasMapFigure(location, map);
	const lead = `All ${areas.length} ${plural} in ${locationLabel(location)} ranked by ${midSentence(rankedValueLabel(map))}, from ${areas[0].name} to ${areas.at(-1)!.name}.`;
	return pageMetadata({
		// This segment has its own opengraph-image.
		image: null,
		// Short, so a search result is less likely to cut it off.
		subject: `${place}, Ranked`,
		description: figure ? `${figure} ${lead}` : lead,
		path: `/maps/${location.slug}/${map.slug}`,
	});
}

export default async function RankingPage({ params }: { params: Params }) {
	const resolved = await resolvePage(params);
	const { location, map, ranking, areas, plural, subject } = resolved;
	const figure = atlasMapFigure(location, map);
	const nouns = LEVEL_NOUNS[ranking.level];
	const columns = ranking.columns ?? [];
	const heading = subject.split(": ");
	const long = isLongRanking(areas);
	const shown = long ? SERVER_ROWS : areas.length;
	const row = (index: number) => rankingRow(resolved, areas[index]!, index);
	const rows = areas.slice(0, shown).map((_, index) => row(index));
	const positions = summaryPositions(areas.length);

	return (
		<div className="min-h-screen bg-[#f3f3f1] text-slate-700">
			<JsonLd
				data={rankingJsonLd(
					location,
					map,
					subject,
					areas.length,
					rows.slice(0, LEADERS),
				)}
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
								All {areas.length.toLocaleString("en-GB")}{" "}
								{heading[1]}
							</span>
						</h1>
						{figure && (
							<p className="mt-4 text-[17px] leading-[1.7] text-slate-700">
								{figure}
							</p>
						)}
						<p className="mt-3 text-[15px] leading-[1.7] text-slate-600">
							All {areas.length.toLocaleString("en-GB")} {plural}{" "}
							in {locationLabel(location)}, ranked by{" "}
							{midSentence(rankedValueLabel(map))}. Data:{" "}
							<a
								href={map.source.sourceUrl}
								target="_blank"
								rel="noopener noreferrer"
								className={rankingLinkClass}
							>
								{map.source.source}
							</a>{" "}
							({map.source.year}),{" "}
							<a
								href={map.source.licenceUrl}
								target="_blank"
								rel="noopener noreferrer"
								className={rankingLinkClass}
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

					{positions && (
						<RankingSummary
							one={nouns.one}
							rows={{
								top: positions.top.map(row),
								bottom: positions.bottom.map(row),
								middle: row(positions.middle),
							}}
						/>
					)}

					<Card
						className={`mt-9 ${columns.length > 1 ? "max-w-[1180px]" : "max-w-[900px]"}`}
					>
						<RankingTable
							initial={rows}
							total={areas.length}
							url={
								long
									? `/data/rankings/${location.slug}/${map.slug}`
									: null
							}
							noun={plural}
							nameLabel={titleCase(nouns.one)}
							valueLabel={rankedValueLabel(map)}
							columns={columns.map((column) => column.label)}
							scale={barScale(areas)}
						/>
					</Card>
				</Sheet>
			</main>
		</div>
	);
}
