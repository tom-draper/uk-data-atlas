import type { Metadata } from "next";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import { Eyebrow, Sheet } from "@/components/docs/Page";
import PlaceSearch from "@/components/places/PlaceSearch";
import {
	geographyName,
	geographyNoun,
	namedKindName,
} from "@/lib/places/labels";
import { PLACE_INDEX } from "@/lib/places/load";
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

/** A section of links, folded away when it is long; still in the page's HTML. */
function PlaceSection({
	title,
	entries,
}: {
	title: string;
	entries: PlaceIndexEntry[];
}) {
	const heading = (
		<h2 className="text-[20px] font-semibold tracking-tight text-slate-900">
			{title}{" "}
			<span className="text-[15px] font-normal text-slate-500">
				{entries.length}
			</span>
		</h2>
	);
	if (entries.length <= 40)
		return (
			<section className="mt-10">
				{heading}
				<PlaceList entries={entries} />
			</section>
		);
	return (
		<details className="group mt-10">
			<summary className="cursor-pointer list-none">
				{heading}
				<span className="text-[14px] text-slate-500 group-open:hidden">
					Show all
				</span>
			</summary>
			<PlaceList entries={entries} />
		</details>
	);
}

function PlaceList({ entries }: { entries: PlaceIndexEntry[] }) {
	return (
		<ul className="mt-3 columns-2 gap-x-6 text-[14px] sm:columns-3 lg:columns-4">
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

export default function PlacesPage() {
	const counts = PLACE_INDEX.areas.reduce<Record<string, number>>(
		(totals, [, , geography]) => ({
			...totals,
			[geography]: (totals[geography] ?? 0) + 1,
		}),
		{},
	);
	const current = (geography: string) =>
		PLACE_INDEX.areas.filter(
			([, , kind, , , lastYear]) =>
				kind === geography && lastYear === null,
		);

	return (
		<div className="min-h-screen bg-[#f3f3f1] text-slate-700">
			<Navigation />
			<main className="mx-auto max-w-[1480px] px-3 sm:px-4">
				<Sheet>
					<div className="max-w-[760px]">
						<Eyebrow>Places</Eyebrow>
						<h1 className="text-[32px] leading-[1.15] font-semibold tracking-tight text-slate-900 sm:text-[38px]">
							Look up any place
						</h1>
						<p className="mt-4 text-[17px] leading-[1.7] text-slate-600">
							Every ward, local authority and Westminster
							constituency published since the archive began,
							current or abolished, and the counties, regions and
							groupings people know them by. Each has a page with
							its map, its boundary history, what it sits within
							and borders, and the data published for it.
						</p>
						<div className="mt-8">
							<PlaceSearch />
						</div>
						<p className="mt-3 text-[13px] text-slate-500">
							{PLACE_INDEX.areas.length.toLocaleString("en-GB")}{" "}
							areas:{" "}
							{(
								[
									"ward",
									"localAuthority",
									"constituency",
								] as const
							)
								.map(
									(geography) =>
										`${(counts[geography] ?? 0).toLocaleString("en-GB")} ${geographyNoun(geography, true)}`,
								)
								.join(", ")}
							, and {PLACE_INDEX.named.length} named places.
						</p>
					</div>

					{NAMED_KINDS.filter((kind) =>
						PLACE_INDEX.named.some((entry) => entry[2] === kind),
					).map((kind) => (
						<PlaceSection
							key={kind}
							title={namedKindName(kind, true)}
							entries={PLACE_INDEX.named.filter(
								(entry) => entry[2] === kind,
							)}
						/>
					))}

					{(["localAuthority", "constituency"] as const).map(
						(geography) => (
							<PlaceSection
								key={geography}
								title={geographyName(geography, true)}
								entries={current(geography)}
							/>
						),
					)}
					<p className="mt-10 text-[14px] text-slate-500">
						Wards are listed on their local authority&apos;s page.
					</p>
				</Sheet>
			</main>
		</div>
	);
}
