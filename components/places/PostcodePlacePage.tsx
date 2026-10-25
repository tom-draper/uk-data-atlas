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
	POSTCODE_GEOGRAPHIES,
	type AreaShare,
	type PostcodeDistrict,
	type PostcodeDistricts,
	type PostcodeGeography,
} from "@/lib/places/postcodes";

type Named = { code: string; name: string; href?: string };

const count = (value: number) => value.toLocaleString("en-GB");

const share = (live: number, total: number) => {
	const percent = (live / total) * 100;
	return percent >= 99.95
		? "100%"
		: percent < 0.1
			? "<0.1%"
			: `${percent.toFixed(1)}%`;
};

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
							{count(inArea)}{" "}
							{inArea === 1 ? "postcode" : "postcodes"}
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

export async function PostcodePlacePage({
	district,
	entry,
	source,
}: {
	district: string;
	entry: PostcodeDistrict;
	source: PostcodeDistricts["source"];
}) {
	const index = await loadPlaceIndex();
	const names = new Map(index.areas.map(([code, name]) => [code, name]));
	const areas = Object.fromEntries(
		POSTCODE_GEOGRAPHIES.map((geography) => [
			geography,
			entry.areas[geography].map(([code]): Named => {
				const name = names.get(code);
				return {
					code,
					name: name ?? code,
					href: name ? areaHref({ geography, code }) : undefined,
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
	const sectors = entry.sectors.length;
	const mostly = (shares: AreaShare) => shares[0]![1] / entry.live > 0.5;
	const lede = `${district} is a postcode district${where ? ` in ${where}` : ""}, with ${count(entry.live)} live ${entry.live === 1 ? "postcode" : "postcodes"} in ${sectors} ${sectors === 1 ? "sector" : "sectors"}.${
		ward && constituency
			? ` ${mostly(entry.areas.ward) && mostly(entry.areas.constituency) ? "Most of them are" : "The largest shares are"} in ${ward.name} ${geographyNoun("ward")} and the ${constituency.name} ${geographyNoun("constituency")}.`
			: ""
	}`;

	return (
		<>
			<PlaceHeader
				path={`/places/postcodes/${district}`}
				place={{
					name: `${district} postcode district`,
					code: district,
					bbox: entry.bbox,
				}}
				trail={placeTrail(
					[NATIONS[council?.code[0] ?? ""], region],
					...(council
						? [{ label: council.name, href: council.href }]
						: []),
					{ label: district },
				)}
				eyebrow="Postcode district"
				title={district}
				lede={lede}
				pill={null}
			/>
			<PlaceLayout
				aside={
					<>
						<h2 className="text-[15px] font-semibold text-slate-900">
							Sectors
						</h2>
						<ul className="mt-3 divide-y divide-slate-900/[0.06] text-[14px]">
							{entry.sectors.map(([sector, live]) => (
								<li
									key={sector}
									className="flex justify-between py-1.5"
								>
									<span className="text-slate-800">
										{sector}
									</span>
									<span className="text-slate-500 tabular-nums">
										{count(live)}{" "}
										{live === 1 ? "postcode" : "postcodes"}
									</span>
								</li>
							))}
						</ul>
						<h2 className="mt-6 text-[15px] font-semibold text-slate-900">
							Nearby districts
						</h2>
						<p className="mt-2 text-[14px] leading-relaxed">
							{entry.nearby.map((other, at) => (
								<span key={other}>
									{at > 0 && ", "}
									<Link
										href={`/places/postcodes/${other}`}
										className={linkClass}
									>
										{other}
									</Link>
								</span>
							))}
						</p>
					</>
				}
			>
				{shapes.length > 0 && (
					<>
						<Card className="p-1.5">
							<PlaceMap
								shapes={shapes}
								bbox={entry.bbox}
								label={`Wards in ${district}`}
								geography="ward"
							/>
						</Card>
						<p className="mt-2 text-[12.5px] text-slate-500">
							The wards its postcodes fall in. Postcode districts
							have no official boundary.
						</p>
					</>
				)}
				<Facts
					items={[
						{ label: "Live postcodes", value: count(entry.live) },
						{ label: "Sectors", value: sectors },
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
						How many of {district}&apos;s live postcodes fall in
						each area. A postcode is placed by its centre, so some
						of its addresses can lie across a boundary.
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
				<Section id="api" title="Ask the API">
					<p className="mb-4">
						The UK Data Atlas API finds the council, ward and
						constituency of any postcode in the district, for
						example {entry.example}.
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
