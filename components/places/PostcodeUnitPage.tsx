import Link from "next/link";
import { Card } from "@/components/docs/Page";
import PlaceMap, { type PlaceShape } from "@/components/places/PlaceMap";
import {
	count,
	DecileChart,
	DEPRIVATION_NAMES,
	districtHref,
	NearbyLinks,
} from "@/components/places/PostcodePlacePage";
import {
	ApiRequests,
	Facts,
	linkClass,
	PlaceHeader,
	PlaceLayout,
	PlaceLink,
	Rows,
	Section,
} from "@/components/places/PlaceUi";
import { NATIONS, placeTrail, regionIn } from "@/components/places/trail";
import { areaHref, dateLabel, geographyNoun } from "@/lib/places/labels";
import { loadAreaProfiles, loadPlaceIndex } from "@/lib/places/load";
import { postcodeHref, type PostcodeUnit } from "@/lib/places/postcodeUnit";
import {
	DEPRIVATION_INDICES,
	sectorHref,
	type PlaceNeighbourhoods,
	type PostcodeGroup,
	type PostcodeSource,
} from "@/lib/places/postcodes";

/** YYYYMM as "January 1980". */
const month = (value: number) =>
	dateLabel(`${String(value).slice(0, 4)}-${String(value).slice(4, 6)}-01`);

// The directory's positional quality indicators, as where a centre sits.
const QUALITY: Record<string, string> = {
	"1": "within the building of the matched address closest to the postcode's mean position",
	"2": "within the building of the matched address closest to the postcode's mean position, placed by inspecting maps",
	"3": "to within about 50 metres",
	"4": "at the mean of its matched addresses, not snapped to a building",
	"5": "by reference to the surrounding postcodes, as ONS imputed it",
	"6": "at the mean of its postcode sector, as for many PO boxes",
	"8": "where ONS last knew it, as it was terminated before November 2000",
};

type Named = { code: string; name: string; href?: string };

/** The neighbourhood an index ranks it in, from the first index that does. */
function rankedNeighbourhood(
	unit: PostcodeUnit,
	neighbourhoods: PlaceNeighbourhoods | null,
) {
	for (const index of DEPRIVATION_INDICES) {
		const code = unit.neighbourhoods[index];
		const area = code ? neighbourhoods?.[index].areas[code] : undefined;
		if (code && area) {
			const [name, rank, decile] = area;
			return {
				index,
				code,
				name,
				rank,
				decile,
				total: neighbourhoods![index].total,
			};
		}
	}
	return undefined;
}

/** "WA3 5DW is in Warrington 003B…", its neighbourhood's rank and decile. */
export function neighbourhoodSummary(
	postcode: string,
	neighbourhood: NonNullable<ReturnType<typeof rankedNeighbourhood>>,
) {
	const about = DEPRIVATION_NAMES[neighbourhood.index];
	const moreDeprived = Math.round(
		((neighbourhood.rank - 1) / neighbourhood.total) * 100,
	);
	return `${postcode} is in the ${neighbourhood.name} ${about.area}, ranked ${count(neighbourhood.rank)} of ${count(neighbourhood.total)} in ${about.nation}, where 1 is the most deprived. That puts it in decile ${neighbourhood.decile}: ${moreDeprived}% of ${about.nation}'s ${about.areas} are more deprived.`;
}

/** A single postcode's page. */
export async function PostcodeUnitPage({
	unit,
	sector,
	neighbourhoods,
	source,
}: {
	unit: PostcodeUnit;
	/** Its sector, where the sector has a live postcode. */
	sector?: PostcodeGroup;
	neighbourhoods: PlaceNeighbourhoods | null;
	source: PostcodeSource;
}) {
	const index = await loadPlaceIndex();
	const names = new Map(index.areas.map(([code, label]) => [code, label]));
	const named = (
		geography: keyof PostcodeUnit["areas"],
	): Named | undefined => {
		const code = unit.areas[geography];
		if (!code) return undefined;
		const label = names.get(code);
		return {
			code,
			name: label ?? code,
			href: label ? areaHref({ geography, code }) : undefined,
		};
	};
	const council = named("localAuthority");
	const ward = named("ward");
	const constituency = named("constituency");
	const profiles = await loadAreaProfiles(
		[council?.code, ward?.code].filter((code) => code !== undefined),
	);
	const region = council
		? regionIn(profiles.get(council.code)?.namedPlaces)
		: undefined;
	const nation = NATIONS[council?.code[0] ?? ""];
	const wardOutline = ward ? profiles.get(ward.code)?.outline : undefined;
	const shapes: PlaceShape[] =
		ward && wardOutline
			? [{ code: ward.code, name: ward.name, outline: wardOutline }]
			: [];
	const neighbourhood = rankedNeighbourhood(unit, neighbourhoods);
	const live = unit.terminated === 0;

	const where = [
		ward ? `${ward.name} ${geographyNoun("ward")}` : undefined,
		council?.name,
	]
		.filter(Boolean)
		.join(", ");
	const lede = `${unit.postcode} is a postcode${where ? ` in ${where}` : ""}${constituency ? `, in the ${constituency.name} ${geographyNoun("constituency")}` : ""}. ${
		live
			? `It has been in use since ${month(unit.introduced)}.`
			: `It was in use from ${month(unit.introduced)} to ${month(unit.terminated)}, and is no longer used for addresses.`
	}${unit.largeUser ? " It serves a single large user, such as a business, rather than a group of addresses." : ""}`;

	const [lng, lat] = unit.lngLat ?? [];
	const bbox =
		lng !== undefined && lat !== undefined
			? ([lng - 0.012, lat - 0.007, lng + 0.012, lat + 0.007] as [
					number,
					number,
					number,
					number,
				])
			: undefined;

	return (
		<>
			<PlaceHeader
				path={postcodeHref(unit.postcode)}
				place={{ name: unit.postcode, code: unit.postcode }}
				trail={placeTrail(
					[nation, region],
					...(council
						? [{ label: council.name, href: council.href }]
						: []),
					{ label: unit.district, href: districtHref(unit.district) },
					...(sector
						? [
								{
									label: unit.sector,
									href: sectorHref(unit.sector),
								},
							]
						: []),
					{ label: unit.postcode },
				)}
				eyebrow={live ? "Postcode" : "Terminated postcode"}
				title={unit.postcode}
				lede={lede}
				pill={null}
			/>
			<PlaceLayout
				aside={
					<>
						<h2 className="text-[15px] font-semibold text-slate-900">
							Part of
						</h2>
						<ul className="mt-3 mb-6 divide-y divide-slate-900/[0.06] text-[14px]">
							{sector && (
								<li className="flex justify-between py-1.5">
									<Link
										href={sectorHref(unit.sector)}
										className={linkClass}
									>
										{unit.sector}
									</Link>
									<span className="text-slate-500">
										Sector
									</span>
								</li>
							)}
							<li className="flex justify-between py-1.5">
								<Link
									href={districtHref(unit.district)}
									className={linkClass}
								>
									{unit.district}
								</Link>
								<span className="text-slate-500">District</span>
							</li>
						</ul>
						{unit.nearby.length > 0 && (
							<NearbyLinks
								title="Nearby postcodes"
								items={unit.nearby}
								href={postcodeHref}
							/>
						)}
					</>
				}
			>
				{bbox && (
					<>
						<Card className="p-1.5">
							<PlaceMap
								shapes={shapes}
								bbox={bbox}
								label={unit.postcode}
								geography="ward"
								marker={unit.lngLat}
							/>
						</Card>
						<p className="mt-2 text-[12.5px] text-slate-500">
							The postcode&apos;s centre
							{ward
								? `, in ${ward.name} ${geographyNoun("ward")}`
								: ""}
							.
						</p>
					</>
				)}
				<Facts
					items={[
						{
							label: "Status",
							value: live
								? "Live"
								: `Terminated ${month(unit.terminated)}`,
						},
						{ label: "Introduced", value: month(unit.introduced) },
						{
							label: "User type",
							value: unit.largeUser ? "Large user" : "Small user",
						},
						...(lng !== undefined && lat !== undefined
							? [
									{
										label: "Latitude, longitude",
										value: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
									},
								]
							: []),
						...(unit.grid
							? [
									{
										label: "Easting, northing",
										value: `${unit.grid[0]}, ${unit.grid[1]}`,
									},
								]
							: []),
					]}
				/>
				<Section id="areas" title="Its areas">
					<p className="mb-4">
						The areas {unit.postcode}&apos;s centre falls in.
						{QUALITY[unit.quality]
							? ` ONS places that centre ${QUALITY[unit.quality]}.`
							: ""}
					</p>
					<Rows
						rows={[
							...(ward
								? [
										{
											label: "Ward",
											value: (
												<PlaceLink href={ward.href}>
													{ward.name}
												</PlaceLink>
											),
										},
									]
								: []),
							...(council
								? [
										{
											label: "Council",
											value: (
												<PlaceLink href={council.href}>
													{council.name}
												</PlaceLink>
											),
										},
									]
								: []),
							...(constituency
								? [
										{
											label: "Westminster constituency",
											value: (
												<PlaceLink
													href={constituency.href}
												>
													{constituency.name}
												</PlaceLink>
											),
										},
									]
								: []),
							...(region
								? [
										{
											label: "Region",
											value: (
												<PlaceLink
													href={`/places/${region.id}`}
												>
													{region.label}
												</PlaceLink>
											),
										},
									]
								: []),
							...(nation
								? [
										{
											label: "Nation",
											value: (
												<PlaceLink
													href={`/places/${nation.id}`}
												>
													{nation.label}
												</PlaceLink>
											),
										},
									]
								: []),
						]}
					/>
				</Section>
				{neighbourhood && (
					<Section id="deprivation" title="Deprivation">
						<p>
							{neighbourhoodSummary(unit.postcode, neighbourhood)}
						</p>
						{sector?.deprivation[neighbourhood.index] && (
							<Card className="mt-4 p-4">
								<p className="mb-3 text-[13px] text-slate-500">
									Live postcodes in {unit.sector} by the
									decile of the{" "}
									{
										DEPRIVATION_NAMES[neighbourhood.index]
											.area
									}{" "}
									they fall in, with {unit.postcode}&apos;s
									decile darker
								</p>
								<DecileChart
									deciles={
										sector.deprivation[neighbourhood.index]!
									}
									highlight={neighbourhood.decile}
								/>
							</Card>
						)}
						<p className="mt-3 text-[12.5px] leading-relaxed text-slate-500">
							The {DEPRIVATION_NAMES[neighbourhood.index].area} is{" "}
							{neighbourhood.index === "simd"
								? "a data zone, home to some 800 people"
								: "an LSOA, home to some 1,500 people"}{" "}
							({neighbourhood.code}). Deprivation describes the
							neighbourhood, not each household in it. From the{" "}
							<Link
								href={`/datasets#${neighbourhood.index}`}
								className={linkClass}
							>
								{DEPRIVATION_NAMES[neighbourhood.index].title}{" "}
								{DEPRIVATION_NAMES[neighbourhood.index].year}
							</Link>
							.
						</p>
					</Section>
				)}
				<Section id="api" title="Ask the API">
					<p className="mb-4">
						The UK Data Atlas API returns {unit.postcode}&apos;s
						status, centre and areas, and those of any other
						postcode.
					</p>
					<ApiRequests
						requests={[
							{
								operationId: "resolvePostcode",
								label: "This postcode's areas",
								path: `/v1/postcodes/${unit.postcode.replace(" ", "")}`,
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
