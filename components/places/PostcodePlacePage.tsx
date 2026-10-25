import Link from "next/link";
import { Card } from "@/components/docs/Page";
import PlaceMap, { type PlaceShape } from "@/components/places/PlaceMap";
import {
	ApiRequests,
	Facts,
	linkClass,
	PlaceHeader,
	PlaceLayout,
	PlaceLink,
	Section,
} from "@/components/places/PlaceUi";
import { NATIONS, placeTrail, regionIn } from "@/components/places/trail";
import { areaHref, geographyNoun, listNames } from "@/lib/places/labels";
import { loadAreaProfiles, loadPlaceIndex } from "@/lib/places/load";
import {
	DEPRIVATION_INDICES,
	POSTCODE_GEOGRAPHIES,
	sectorHref,
	type AreaShare,
	type DeprivationIndex,
	type PostcodeGeography,
	type PostcodeGroup,
	type PostcodeSource,
} from "@/lib/places/postcodes";

type Named = { code: string; name: string; href?: string };

const count = (value: number) => value.toLocaleString("en-GB");

const postcodes = (value: number) =>
	`${count(value)} ${value === 1 ? "postcode" : "postcodes"}`;

const share = (part: number, total: number) => {
	const percent = (part / total) * 100;
	return percent >= 99.95
		? "100%"
		: percent === 0
			? "0%"
			: percent < 0.1
				? "<0.1%"
				: `${percent.toFixed(1)}%`;
};

const districtHref = (district: string) => `/places/postcodes/${district}`;

const GEOGRAPHY_TITLES: Record<PostcodeGeography, string> = {
	localAuthority: "Councils",
	ward: "Wards",
	constituency: "Constituencies",
};

/** "Leeds", or "Leeds and Bradford" for a district on a council boundary. */
function mainAreas(areas: Named[], shares: AreaShare, live: number) {
	// Areas holding at least a tenth of the postcodes, so a stray few don't.
	const main = areas.filter((_, at) => shares[at]![1] / live >= 0.1);
	return listNames(
		(main.length > 0 ? main : areas.slice(0, 1)).map((area) => area.name),
	);
}

function ShareList({
	areas,
	shares,
	live,
}: {
	areas: Named[];
	shares: AreaShare;
	live: number;
}) {
	return (
		<Card className="divide-y divide-slate-900/[0.06]">
			{areas.map((area, at) => {
				const inArea = shares[at]![1];
				return (
					<div
						key={area.code}
						className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_9rem_10rem]"
					>
						<span className="min-w-0 text-[15px]">
							<PlaceLink href={area.href}>{area.name}</PlaceLink>
						</span>
						<span className="text-right text-[14px] text-slate-500 tabular-nums">
							{postcodes(inArea)}
						</span>
						<span className="col-span-2 flex items-center gap-2 sm:col-span-1">
							<span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
								<span
									className="block h-full rounded-full bg-slate-400"
									style={{
										width: `${(inArea / live) * 100}%`,
									}}
								/>
							</span>
							<span className="w-12 text-right text-[13px] font-medium text-slate-800 tabular-nums">
								{share(inArea, live)}
							</span>
						</span>
					</div>
				);
			})}
		</Card>
	);
}

const DEPRIVATION_NAMES: Record<
	DeprivationIndex,
	{ title: string; nation: string; areas: string; area: string; year: number }
> = {
	imd: {
		title: "English Index of Multiple Deprivation",
		nation: "England",
		areas: "neighbourhoods",
		area: "neighbourhood",
		year: 2025,
	},
	wimd: {
		title: "Welsh Index of Multiple Deprivation",
		nation: "Wales",
		areas: "neighbourhoods",
		area: "neighbourhood",
		year: 2019,
	},
	simd: {
		title: "Scottish Index of Multiple Deprivation",
		nation: "Scotland",
		areas: "data zones",
		area: "data zone",
		year: 2020,
	},
};

/**
 * "The typical postcode in LS6 1 is in a decile 4 neighbourhood…", from the
 * median postcode and the shares at each end.
 */
export function deprivationSummary(
	name: string,
	deciles: number[],
	about: { nation: string; areas: string; area: string },
	several = false,
) {
	const total = deciles.reduce((sum, value) => sum + value, 0);
	let seen = 0;
	const median =
		deciles.findIndex((value) => (seen += value) >= total / 2) + 1;
	const sum = (from: number, to: number) =>
		deciles.slice(from, to).reduce((total, value) => total + value, 0);
	return `The typical postcode in ${name}${several ? ` in ${about.nation}` : ""} is in a decile ${median} ${about.area}, where decile 1 is ${about.nation}'s most deprived 10% of ${about.areas}. ${share(sum(0, 3), total)} of its postcodes are in the most deprived 30%, and ${share(sum(7, 10), total)} in the least deprived 30%.`;
}

/** Live postcodes by decile, as columns from most to least deprived. */
function DecileChart({ deciles }: { deciles: number[] }) {
	const total = deciles.reduce((sum, value) => sum + value, 0);
	const most = Math.max(...deciles);
	return (
		<div>
			<div
				role="img"
				aria-label={deciles
					.map(
						(value, at) =>
							`Decile ${at + 1}: ${share(value, total)}`,
					)
					.join(", ")}
				className="flex h-32 items-end gap-1.5"
			>
				{deciles.map((value, at) => (
					<div
						key={at}
						className="flex h-full flex-1 flex-col justify-end"
					>
						<span className="mb-1 text-center text-[11.5px] text-slate-500 tabular-nums">
							{value > 0
								? `${Math.round((value / total) * 100)}%`
								: ""}
						</span>
						<span
							className="rounded-t-sm bg-slate-400"
							style={{
								height: `${(value / most) * 78}%`,
								minHeight: value > 0 ? 2 : 0,
							}}
						/>
					</div>
				))}
			</div>
			<div className="flex gap-1.5 border-t border-slate-300 pt-1 text-center text-[11.5px] text-slate-500 tabular-nums">
				{deciles.map((_, at) => (
					<span key={at} className="flex-1">
						{at + 1}
					</span>
				))}
			</div>
			<div className="mt-0.5 flex justify-between text-[12px] text-slate-500">
				<span>Most deprived</span>
				<span>Least deprived</span>
			</div>
		</div>
	);
}

function DeprivationSection({
	name,
	deprivation,
}: {
	name: string;
	deprivation: PostcodeGroup["deprivation"];
}) {
	const indices = DEPRIVATION_INDICES.filter((index) => deprivation[index]);
	if (indices.length === 0) return null;
	return (
		<Section id="deprivation" title="Deprivation">
			{indices.map((index) => {
				const deciles = deprivation[index]!;
				const total = deciles.reduce((sum, value) => sum + value, 0);
				const about = DEPRIVATION_NAMES[index];
				return (
					<div key={index} className="mb-8 last:mb-0">
						<p>
							{deprivationSummary(
								name,
								deciles,
								about,
								indices.length > 1,
							)}
						</p>
						<Card className="mt-4 p-4">
							<p className="mb-3 text-[13px] text-slate-500">
								Live postcodes by the decile of the {about.area}{" "}
								they fall in, {about.year}
							</p>
							<DecileChart deciles={deciles} />
						</Card>
						<p className="mt-3 text-[12.5px] leading-relaxed text-slate-500">
							Each postcode takes the decile of the{" "}
							{index === "simd" ? "data zone" : "LSOA"} its centre
							falls in. From the{" "}
							<Link
								href={`/datasets#${index}`}
								className={linkClass}
							>
								{about.title} {about.year}
							</Link>
							.
						</p>
					</div>
				);
			})}
		</Section>
	);
}

function AsideList({
	title,
	items,
	current,
}: {
	title: string;
	items: [name: string, live: number][];
	current: string;
}) {
	return (
		<>
			<h2 className="text-[15px] font-semibold text-slate-900">
				{title}
			</h2>
			<ul className="mt-3 mb-6 divide-y divide-slate-900/[0.06] text-[14px]">
				{items.map(([name, live]) => (
					<li key={name} className="flex justify-between py-1.5">
						{name === current ? (
							<span className="font-medium text-slate-900">
								{name}
							</span>
						) : (
							<Link href={sectorHref(name)} className={linkClass}>
								{name}
							</Link>
						)}
						<span className="text-slate-500 tabular-nums">
							{postcodes(live)}
						</span>
					</li>
				))}
			</ul>
		</>
	);
}

function NearbyLinks({ title, items }: { title: string; items: string[] }) {
	return (
		<>
			<h2 className="text-[15px] font-semibold text-slate-900">
				{title}
			</h2>
			<p className="mt-2 text-[14px] leading-relaxed">
				{items.map((other, at) => (
					<span key={other}>
						{at > 0 && ", "}
						<Link
							href={
								other.includes(" ")
									? sectorHref(other)
									: districtHref(other)
							}
							className={linkClass}
						>
							{other}
						</Link>
					</span>
				))}
			</p>
		</>
	);
}

/** A postcode district's or sector's page. */
export async function PostcodePlacePage({
	name,
	district,
	sectors,
	entry,
	source,
}: {
	/** "LS6" for a district, "LS6 1" for a sector. */
	name: string;
	district: string;
	/** The district's sectors and their live postcodes. */
	sectors: [sector: string, live: number][];
	entry: PostcodeGroup;
	source: PostcodeSource;
}) {
	const isSector = name !== district;
	const kind = isSector ? "sector" : "district";
	const index = await loadPlaceIndex();
	const names = new Map(index.areas.map(([code, label]) => [code, label]));
	const areas = Object.fromEntries(
		POSTCODE_GEOGRAPHIES.map((geography) => [
			geography,
			entry.areas[geography].map(([code]): Named => {
				const label = names.get(code);
				return {
					code,
					name: label ?? code,
					href: label ? areaHref({ geography, code }) : undefined,
				};
			}),
		]),
	) as Record<PostcodeGeography, Named[]>;
	const council = areas.localAuthority[0];
	const constituency = areas.constituency[0];
	const ward = areas.ward[0];

	const profiles = await loadAreaProfiles([
		...(council ? [council.code] : []),
		...areas.ward.map((area) => area.code),
	]);
	const region = council
		? regionIn(profiles.get(council.code)?.namedPlaces)
		: undefined;
	const shapes: PlaceShape[] = areas.ward.flatMap((area) => {
		const outline = profiles.get(area.code)?.outline;
		return outline
			? [{ code: area.code, name: area.name, outline, href: area.href }]
			: [];
	});

	const where = council
		? mainAreas(
				areas.localAuthority,
				entry.areas.localAuthority,
				entry.live,
			)
		: undefined;
	const sectorCount = `${sectors.length} ${sectors.length === 1 ? "sector" : "sectors"}`;
	const mostly = (shares: AreaShare) => shares[0]![1] / entry.live > 0.5;
	const lede = `${name} is a postcode ${kind}${where ? ` in ${where}` : ""}, with ${count(entry.live)} live ${entry.live === 1 ? "postcode" : "postcodes"}${
		isSector
			? `. It is one of ${sectorCount} in the ${district} district`
			: ` in ${sectorCount}`
	}.${
		ward && constituency
			? ` ${mostly(entry.areas.ward) && mostly(entry.areas.constituency) ? "Most of them are" : "The largest shares are"} in ${ward.name} ${geographyNoun("ward")} and the ${constituency.name} ${geographyNoun("constituency")}.`
			: ""
	}`;

	return (
		<>
			<PlaceHeader
				path={isSector ? sectorHref(name) : districtHref(name)}
				place={{
					name: `${name} postcode ${kind}`,
					code: name,
					bbox: entry.bbox,
				}}
				trail={placeTrail(
					[NATIONS[council?.code[0] ?? ""], region],
					...(council
						? [{ label: council.name, href: council.href }]
						: []),
					...(isSector
						? [{ label: district, href: districtHref(district) }]
						: []),
					{ label: name },
				)}
				eyebrow={`Postcode ${kind}`}
				title={name}
				lede={lede}
				pill={null}
			/>
			<PlaceLayout
				aside={
					<>
						<AsideList
							title={
								isSector ? `Sectors in ${district}` : "Sectors"
							}
							items={sectors}
							current={name}
						/>
						<NearbyLinks
							title={
								isSector ? "Nearby sectors" : "Nearby districts"
							}
							items={entry.nearby}
						/>
					</>
				}
			>
				{shapes.length > 0 && (
					<>
						<Card className="p-1.5">
							<PlaceMap
								shapes={shapes}
								bbox={entry.bbox}
								label={`Wards in ${name}`}
								geography="ward"
							/>
						</Card>
						<p className="mt-2 text-[12.5px] text-slate-500">
							The wards its postcodes fall in. Postcode {kind}s
							have no official boundary.
						</p>
					</>
				)}
				<Facts
					items={[
						{ label: "Live postcodes", value: count(entry.live) },
						isSector
							? {
									label: "District",
									value: (
										<Link
											href={districtHref(district)}
											className={linkClass}
										>
											{district}
										</Link>
									),
								}
							: { label: "Sectors", value: sectors.length },
						{
							label: "Large-user postcodes",
							value: count(entry.largeUser),
						},
						{
							label: "Terminated postcodes",
							value: count(entry.terminated),
						},
					]}
				/>
				<Section id="areas" title="Where its postcodes are">
					<p className="mb-4">
						How many of {name}&apos;s live postcodes fall in each
						area. A postcode is placed by its centre, so some of its
						addresses can lie across a boundary.
					</p>
					<div className="space-y-6">
						{POSTCODE_GEOGRAPHIES.filter(
							(geography) => areas[geography].length > 0,
						).map((geography) => (
							<div key={geography}>
								<h3 className="mb-2 text-[14px] font-medium text-slate-800">
									{GEOGRAPHY_TITLES[geography]}
								</h3>
								<ShareList
									areas={areas[geography]}
									shares={entry.areas[geography]}
									live={entry.live}
								/>
							</div>
						))}
					</div>
				</Section>
				<DeprivationSection
					name={name}
					deprivation={entry.deprivation}
				/>
				<Section id="api" title="Ask the API">
					<p className="mb-4">
						The UK Data Atlas API finds the council, ward and
						constituency of any postcode in the {kind}, for example{" "}
						{entry.example}.
					</p>
					<ApiRequests
						requests={[
							{
								operationId: "resolvePostcode",
								label: "A postcode's areas",
								path: `/v1/postcodes/${entry.example.replace(" ", "")}`,
							},
						]}
					/>
				</Section>
				<p className="mt-10 text-[12.5px] leading-relaxed text-slate-500">
					From the {source.title}. {source.attribution.join(". ")}.
				</p>
			</PlaceLayout>
		</>
	);
}
