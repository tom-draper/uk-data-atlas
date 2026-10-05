import type { Metadata } from "next";
import Link from "next/link";
import { H2, H3, P } from "@/components/docs/Content";
import PlaceSearch from "@/components/places/PlaceSearch";
import ReferencePage from "@/components/reference/ReferencePage";
import {
	geographyName,
	geographyNoun,
	namedKindName,
} from "@/lib/places/labels";
import { PLACE_INDEX, PLACE_REGIONS, placeRegions } from "@/lib/places/load";
import type { PlaceIndexEntry } from "@/lib/places/profile";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
	subject: "Places",
	description:
		"Look up any UK ward, local authority, constituency or named place by code or name: its map, its boundary history, the areas it sits within and the data published for it.",
	path: "/places",
});

const linkClass =
	"text-slate-700 underline decoration-slate-300 underline-offset-[3px] hover:decoration-slate-700";

const NAMED_KINDS = [
	"country",
	"region",
	"combined-authority",
	"county",
	"ceremonial-county",
	"historic-county",
	"editorial-grouping",
];

/** The areas listed by region, each region a section of its own. */
const AREA_SECTIONS = [
	{ geography: "localAuthority", prefix: "councils" },
	{ geography: "constituency", prefix: "constituencies" },
] as const;

function PlaceList({ entries }: { entries: PlaceIndexEntry[] }) {
	return (
		<ul className="columns-2 gap-x-6 text-[14px] sm:columns-3">
			{[...entries]
				.sort((a, b) => a[1].localeCompare(b[1]))
				.map(([id, name]) => (
					<li key={id} className="break-inside-avoid py-0.5">
						<Link href={`/places/${id}`} className={linkClass}>
							{name}
						</Link>
					</li>
				))}
		</ul>
	);
}

function Count({ count }: { count: number }) {
	return (
		<span className="ml-2 text-[14px] font-normal text-slate-400">
			{count.toLocaleString("en-GB")}
		</span>
	);
}

export default async function PlacesPage() {
	const regions = await placeRegions();
	const counts = PLACE_INDEX.areas.reduce<Record<string, number>>(
		(totals, [, , geography]) => ({
			...totals,
			[geography]: (totals[geography] ?? 0) + 1,
		}),
		{},
	);
	const named = NAMED_KINDS.map((kind) => ({
		kind,
		entries: PLACE_INDEX.named.filter((entry) => entry[2] === kind),
	})).filter(({ entries }) => entries.length > 0);
	const areas = AREA_SECTIONS.map(({ geography, prefix }) => ({
		geography,
		prefix,
		regions: PLACE_REGIONS.map((region) => ({
			region,
			entries: PLACE_INDEX.areas.filter(
				([code, , kind, , , lastYear]) =>
					kind === geography &&
					lastYear === null &&
					regions.get(code) === region.id,
			),
		})).filter(({ entries }) => entries.length > 0),
	}));

	return (
		<ReferencePage
			label="Places"
			groups={[
				{
					title: "Named places",
					links: named.map(({ kind }) => ({
						id: kind,
						title: namedKindName(kind, true),
					})),
				},
				...areas.map(({ geography, prefix, regions }) => ({
					title: geographyName(geography, true),
					links: regions.map(({ region }) => ({
						id: `${prefix}-${region.id}`,
						title: region.label,
					})),
				})),
			]}
			eyebrow="Places"
			title="Look up any place"
			lede={
				<>
					<p>
						Every ward, local authority and Westminster constituency
						published since the archive began, current or abolished,
						and the counties, regions and groupings people know them
						by. Each has a page with its map, its boundary history,
						what it sits within and borders, and the data published
						for it.
					</p>
					<div className="mt-8">
						<PlaceSearch />
					</div>
					<p className="mt-3 text-[13px] text-slate-500">
						{PLACE_INDEX.areas.length.toLocaleString("en-GB")}{" "}
						areas:{" "}
						{(["ward", "localAuthority", "constituency"] as const)
							.map(
								(geography) =>
									`${(counts[geography] ?? 0).toLocaleString("en-GB")} ${geographyNoun(geography, true)}`,
							)
							.join(", ")}
						, and {PLACE_INDEX.named.length} named places.
					</p>
				</>
			}
		>
			<H2 id="named-places">Named places</H2>
			<P>
				The places people know areas by. Each region, nation, county and
				combined authority lists its local authorities and their wards.
			</P>
			{named.map(({ kind, entries }) => (
				<section key={kind}>
					<H3 id={kind}>
						{namedKindName(kind, true)}
						<Count count={entries.length} />
					</H3>
					<PlaceList entries={entries} />
				</section>
			))}

			{areas.map(({ geography, prefix, regions }) => (
				<section key={geography}>
					<H2 id={prefix}>
						Current {geographyNoun(geography, true)}
					</H2>
					<P>
						{geography === "localAuthority"
							? "Each local authority's page lists its wards. Those no longer in use can be found by searching."
							: "The constituencies of the 2024 general election. Those no longer in use can be found by searching."}
					</P>
					{regions.map(({ region, entries }) => (
						<section key={region.id}>
							<H3 id={`${prefix}-${region.id}`}>
								{region.label}
								<Count count={entries.length} />
							</H3>
							<p className="-mt-1 mb-3 text-[13px] text-slate-500">
								<Link
									href={`/places/${region.id}`}
									className={linkClass}
								>
									{region.label}
								</Link>
								, with every ward
							</p>
							<PlaceList entries={entries} />
						</section>
					))}
				</section>
			))}
		</ReferencePage>
	);
}
