import Link from "next/link";
import type { ReactNode } from "react";
import { Card, Pill } from "@/components/docs/Page";
import PlaceMap from "@/components/places/PlaceMap";
import {
	AreaGroups,
	ApiRequests,
	Datasets,
	Facts,
	linkClass,
	namedRows,
	PlaceHeader,
	PlaceLayout,
	PlaceLink,
	Rows,
	Section,
} from "@/components/places/PlaceUi";
import PlaceTimeline from "@/components/places/PlaceTimeline";
import { NATIONS, placeTrail, regionIn } from "@/components/places/trail";
import { areaRequests } from "@/lib/places/api";
import {
	areaHref,
	areaKindName,
	countryOf,
	geographyName,
	geographyNoun,
} from "@/lib/places/labels";
import { placeFacts, type PlaceFacts } from "@/lib/places/facts";
import {
	CouncilElectionsSection,
	WardElectionsSection,
} from "@/components/places/PlaceElections";
import { councilElections, wardElections } from "@/lib/places/elections";
import {
	placeHeadlines,
	rankPhrase,
	type PlaceHeadline,
	type Rank,
} from "@/lib/places/headlines";
import { loadAreaProfile, loadPlaceIndex } from "@/lib/places/load";
import { areaPostcodeDistricts } from "@/lib/places/postcodes";
import {
	releaseLabel,
	type AreaProfile,
} from "@uk-data-atlas/catalogue/place-profile";
import { areaSummary } from "@/lib/places/summary";

type Council = AreaProfile["parents"][number];

/** The profiles an area's page borrows from: its council, and its region. */
async function loadAreaContext(profile: AreaProfile) {
	const council = profile.parents.find(
		(parent) => parent.geography === "localAuthority",
	);
	// A ward's named places and wider data are its council's.
	const councilProfile = council
		? await loadAreaProfile(council.code)
		: undefined;
	// A constituency's or town's region is that of a council it sits in or
	// overlaps.
	const regionCouncil =
		profile.geography === "constituency" ||
		profile.geography === "majorTownAndCity"
			? [
					...profile.parents,
					...profile.overlaps.flatMap((group) => group.areas ?? []),
				].find((area) => area.geography === "localAuthority")
			: undefined;
	const region = regionIn(
		profile.namedPlaces ??
			councilProfile?.namedPlaces ??
			(regionCouncil
				? (await loadAreaProfile(regionCouncil.code))?.namedPlaces
				: undefined),
	);
	// A town can span councils, so it takes only their region.
	const namedPlaces =
		profile.namedPlaces ??
		councilProfile?.namedPlaces ??
		(profile.geography === "majorTownAndCity" && region ? [region] : []);
	return { council, councilProfile, region, namedPlaces };
}

function AreaMap({
	profile,
	lastRelease,
}: {
	profile: AreaProfile;
	lastRelease: string;
}) {
	return (
		<>
			{profile.outline && (
				<Card className="p-1.5">
					<PlaceMap
						shapes={[
							{
								code: profile.code,
								name: profile.name,
								outline: profile.outline,
							},
						]}
						bbox={profile.bbox}
						label={profile.name}
						geography={profile.geography}
					/>
				</Card>
			)}
			<p className="mt-2 text-[12.5px] text-slate-500">
				The {releaseLabel(lastRelease)} boundary, generalised to about
				100 m.
			</p>
		</>
	);
}

const sourceClass =
	"block text-[12.5px] font-normal text-slate-500 hover:text-slate-800";

const percent = (value: number) => `${value.toFixed(1)}%`;

/** Residents per km², from the population estimate and the boundary's area. */
function density(profile: AreaProfile) {
	if (!profile.population || !profile.areaKm2) return null;
	const perKm2 = profile.population.value / profile.areaKm2;
	return perKm2.toLocaleString("en-GB", {
		maximumFractionDigits: perKm2 < 10 ? 1 : 0,
	});
}

/** Median age, density and ethnicity, where the datasets publish them. */
function peopleFacts(profile: AreaProfile, facts: PlaceFacts) {
	const items: { label: string; value: ReactNode }[] = [];
	const perKm2 = density(profile);
	if (perKm2)
		items.push({
			label: "Density",
			value: `${perKm2} per km²`,
		});
	if (facts.age) {
		const [median, over65, year] = facts.age;
		items.push({
			label: "Median age",
			value: (
				<>
					{median.toFixed(1)}
					<Link
						href={`/datasets#${profile.population?.dataset ?? "population"}`}
						className={sourceClass}
					>
						{percent(over65)} aged 65+, mid-{year}
					</Link>
				</>
			),
		});
	}
	if (facts.ethnicity) {
		const [white, whiteBritish] = facts.ethnicity;
		items.push({
			label: "Ethnicity",
			value: (
				<>
					{percent(white)} White
					<Link href="/datasets#ethnicity" className={sourceClass}>
						{percent(whiteBritish)} White British, 2021 Census
					</Link>
				</>
			),
		});
	}
	return items;
}

function AreaFacts({
	profile,
	releases,
	facts,
}: {
	profile: AreaProfile;
	releases: string[];
	facts: PlaceFacts;
}) {
	const firstYear = releases[profile.releases[0]!]!.slice(0, 4);
	const lastYear = releases[profile.releases.at(-1)!]!.slice(0, 4);
	return (
		<Facts
			items={[
				{ label: "Code", value: profile.code },
				{ label: "Kind", value: areaKindName(profile) },
				{
					label: "Area",
					value:
						profile.areaKm2 !== undefined
							? `${profile.areaKm2.toLocaleString("en-GB", { maximumFractionDigits: profile.areaKm2 < 10 ? 2 : 0 })} km²`
							: "Not published",
				},
				...(profile.population
					? [
							{
								label: "Population",
								value: (
									<>
										{profile.population.value.toLocaleString(
											"en-GB",
										)}
										<Link
											href={`/datasets#${profile.population.dataset}`}
											className={sourceClass}
										>
											Mid-
											{profile.population.year} estimate
										</Link>
									</>
								),
							},
						]
					: []),
				...peopleFacts(profile, facts),
				{
					label: "In use",
					value: profile.current
						? `${firstYear} to now`
						: `${firstYear} to ${lastYear}`,
				},
			]}
		/>
	);
}

const rankClass = "block text-[12px] text-slate-500 hover:text-slate-800";

/** "12th highest of 361 in England", linked to the ranking's table. */
function RankLine({
	headline,
	rank,
	where,
}: {
	headline: PlaceHeadline;
	rank: Rank;
	where: string;
}) {
	const text = `${rankPhrase(rank.rank, rank.of, headline.ends)} of ${rank.of.toLocaleString("en-GB")} in ${where}`;
	return rank.href ? (
		<Link href={rank.href} className={rankClass}>
			{text}
		</Link>
	) : (
		<span className={rankClass}>{text}</span>
	);
}

/** Where a rank sits on a track, the lowest at the left and highest at the right. */
function RankMarker({ rank }: { rank: Rank }) {
	const position = rank.of > 1 ? (rank.of - rank.rank) / (rank.of - 1) : 0.5;
	return (
		<div className="relative mx-1.5 mb-1.5 h-1 rounded-full bg-slate-200">
			<span
				className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-800 ring-2 ring-white"
				style={{ left: `${position * 100}%` }}
			/>
		</div>
	);
}

/** The area's value on a few ranked maps, and where it ranks on each. */
function AreaFigures({
	profile,
	headlines,
}: {
	profile: AreaProfile;
	headlines: PlaceHeadline[];
}) {
	return (
		<Section id="figures" title="Key figures">
			<p>
				How {profile.name} compares with other{" "}
				{geographyNoun(profile.geography, true)}. Each marker runs from
				the lowest on the left to the highest on the right, and each
				rank links to its full table.
			</p>
			<Card className="mt-4 divide-y divide-slate-900/[0.06]">
				{headlines.map((headline) => (
					<div
						key={headline.map}
						className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_7rem_14rem]"
					>
						<div className="min-w-0">
							<p className="text-[14.5px] font-medium text-slate-900">
								{headline.label}
								<span className="ml-2 text-[12px] font-normal text-slate-400 tabular-nums">
									{headline.year}
								</span>
							</p>
							<p className="text-[12.5px] leading-snug text-slate-500">
								{headline.about}
							</p>
						</div>
						<p className="text-right text-[17px] font-semibold text-slate-900 tabular-nums">
							{headline.value}
						</p>
						<div className="col-span-2 sm:col-span-1">
							<RankMarker rank={headline.national} />
							<RankLine
								headline={headline}
								rank={headline.national}
								where={headline.national.scope}
							/>
							{headline.local && (
								<RankLine
									headline={headline}
									rank={headline.local}
									where={headline.local.name}
								/>
							)}
						</div>
					</div>
				))}
			</Card>
		</Section>
	);
}

function AreaWithin({
	profile,
	council,
	namedPlaces,
}: {
	profile: AreaProfile;
	council: Council | undefined;
	namedPlaces: Parameters<typeof namedRows>[0];
}) {
	const otherParents = profile.parents.filter(
		(parent) => parent.geography !== "localAuthority",
	);
	const country = countryOf(profile.code);
	return (
		<Section id="within" title="Where it sits">
			<Rows
				rows={[
					...(council
						? [
								{
									label: "Local authority",
									value: (
										<PlaceLink href={areaHref(council)}>
											{council.name}
										</PlaceLink>
									),
								},
							]
						: []),
					...otherParents.map((parent) => ({
						label: geographyName(parent.geography),
						value: (
							<PlaceLink href={areaHref(parent)}>
								{parent.name}
							</PlaceLink>
						),
					})),
					...namedRows(namedPlaces),
					...(country &&
					!namedPlaces.some((place) => place.kind === "country")
						? [{ label: "Country", value: country }]
						: []),
				]}
			/>
			{profile.geography === "ward" && (
				<p className="mt-3 text-[13px] text-slate-500">
					A ward is placed in the constituency holding most of it, so
					a ward on a constituency boundary is listed in one.
					{profile.parents.some(
						(parent) => parent.geography === "majorTownAndCity",
					) &&
						" It is placed in a major town or city when its centre falls inside the town's boundary."}
				</p>
			)}
		</Section>
	);
}

function AreaNeighbours({ profile }: { profile: AreaProfile }) {
	return (
		<Section id="neighbours" title="Neighbours">
			<p>
				{profile.neighbours.length}{" "}
				{profile.code.startsWith("W04")
					? profile.neighbours.length === 1
						? "community"
						: "communities"
					: geographyNoun(
							profile.geography,
							profile.neighbours.length !== 1,
						)}{" "}
				{profile.neighbours.length === 1 ? "shares" : "share"} a border
				with {profile.name}, longest border first.
			</p>
			<ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
				{profile.neighbours.map((neighbour) => (
					<li key={neighbour.code}>
						<PlaceLink href={`/places/${neighbour.code}`}>
							{neighbour.name}
						</PlaceLink>{" "}
						<span className="text-[13px] text-slate-500">
							{(neighbour.sharedBorderM / 1000).toFixed(1)} km
						</span>
					</li>
				))}
			</ul>
		</Section>
	);
}

function AreaData({
	profile,
	council,
	councilProfile,
}: {
	profile: AreaProfile;
	council: Council | undefined;
	councilProfile: AreaProfile | undefined;
}) {
	return (
		<Section id="data" title="Data published for it">
			{profile.datasets.length > 0 ? (
				<>
					<p>
						{profile.datasets.length} of the Atlas&apos;s datasets
						publish figures for {profile.name} itself.
					</p>
					<Datasets datasets={profile.datasets} />
				</>
			) : (
				<p>
					None of the Atlas&apos;s datasets publish figures for{" "}
					{profile.name} under this code.
				</p>
			)}
			{councilProfile && councilProfile.datasets.length > 0 && (
				<>
					<p className="mt-6">
						And {councilProfile.datasets.length} more for{" "}
						<PlaceLink href={areaHref(council!)}>
							{councilProfile.name}
						</PlaceLink>
						, the local authority it sits in.
					</p>
					<Datasets datasets={councilProfile.datasets} />
				</>
			)}
			{(profile.mapsSlug ?? councilProfile?.mapsSlug) && (
				<p className="mt-6">
					<Link
						href={`/maps/${profile.mapsSlug ?? councilProfile?.mapsSlug}`}
						className={linkClass}
					>
						See every map of{" "}
						{profile.mapsSlug ? profile.name : councilProfile?.name}
					</Link>
				</p>
			)}
		</Section>
	);
}

function AreaApi({
	profile,
	lastRelease,
}: {
	profile: AreaProfile;
	lastRelease: string;
}) {
	return (
		<Section id="api" title="Ask the API">
			<p className="mb-4">
				Everything on this page comes from the UK Data Atlas API&apos;s
				geography resolver. These requests return it, for the{" "}
				{releaseLabel(lastRelease)} release.
			</p>
			<ApiRequests requests={areaRequests(profile, lastRelease)} />
		</Section>
	);
}

/** The postcode districts with live postcodes in the area. */
function AreaPostcodes({
	profile,
	districts,
}: {
	profile: AreaProfile;
	districts: [district: string, live: number][];
}) {
	const live = districts.reduce((total, [, count]) => total + count, 0);
	return (
		<Section id="postcodes" title="Postcodes">
			<p>
				{profile.name} has {live.toLocaleString("en-GB")} live{" "}
				{live === 1 ? "postcode" : "postcodes"} in{" "}
				{districts.length === 1
					? "one postcode district"
					: `${districts.length} postcode districts`}
				, counting each postcode by its centre.
			</p>
			<p className="mt-3">
				{districts.map(([district, count], at) => (
					<span key={district}>
						{at > 0 && ", "}
						<Link
							href={`/places/postcodes/${district}`}
							className={linkClass}
							title={`${count.toLocaleString("en-GB")} ${count === 1 ? "postcode" : "postcodes"} in ${profile.name}`}
						>
							{district}
						</Link>
					</span>
				))}
			</p>
		</Section>
	);
}

/** A ward's or council's local election results, where the data has them. */
async function loadElections(profile: AreaProfile) {
	if (profile.geography === "ward") {
		const elections = await wardElections(profile.code);
		return elections ? (
			<WardElectionsSection name={profile.name} elections={elections} />
		) : null;
	}
	if (profile.geography === "localAuthority") {
		const elections = await councilElections(profile.code);
		return elections?.length ? (
			<CouncilElectionsSection
				name={profile.name}
				elections={elections}
			/>
		) : null;
	}
	return null;
}

export async function AreaPlacePage({ profile }: { profile: AreaProfile }) {
	const releases = (await loadPlaceIndex()).releases[profile.geography];
	const lastRelease = releases[profile.releases.at(-1)!]!;
	const [
		{ council, councilProfile, region, namedPlaces },
		facts,
		headlines,
		elections,
		postcodeDistricts,
	] = await Promise.all([
		loadAreaContext(profile),
		placeFacts(profile.code),
		placeHeadlines(profile.code, profile.geography),
		loadElections(profile),
		profile.current ? areaPostcodeDistricts(profile.code) : [],
	]);

	return (
		<>
			<PlaceHeader
				path={`/places/${profile.code}`}
				place={{
					name: profile.name,
					code: profile.code,
					...(profile.outline ? { bbox: profile.bbox } : {}),
				}}
				trail={placeTrail(
					[NATIONS[profile.code[0] ?? ""], region],
					...(council
						? [{ label: council.name, href: areaHref(council) }]
						: []),
					{ label: profile.name },
				)}
				eyebrow={`${areaKindName(profile)} · ${profile.code}`}
				title={profile.name}
				lede={await areaSummary(profile)}
				pill={
					profile.current ? (
						<Pill tone="emerald">In use</Pill>
					) : (
						<Pill tone="rose">No longer in use</Pill>
					)
				}
			/>
			<PlaceLayout
				aside={<PlaceTimeline profile={profile} releases={releases} />}
			>
				<AreaMap profile={profile} lastRelease={lastRelease} />
				<AreaFacts
					profile={profile}
					releases={releases}
					facts={facts}
				/>
				{headlines.length > 0 && (
					<AreaFigures profile={profile} headlines={headlines} />
				)}
				{elections}
				{postcodeDistricts.length > 0 && (
					<AreaPostcodes
						profile={profile}
						districts={postcodeDistricts}
					/>
				)}
				<AreaWithin
					profile={profile}
					council={council}
					namedPlaces={namedPlaces}
				/>
				{profile.children.length > 0 && (
					<Section id="contains" title="What it contains">
						{profile.geography === "majorTownAndCity" && (
							<p className="mb-4">
								The wards whose centre falls inside{" "}
								{profile.name}&apos;s boundary. The boundary
								follows the built-up area rather than council or
								ward lines, so a ward on its edge can lie partly
								outside it.
							</p>
						)}
						<AreaGroups groups={profile.children} />
					</Section>
				)}
				{profile.overlaps.length > 0 && (
					<Section id="overlaps" title="What it overlaps">
						<AreaGroups groups={profile.overlaps} />
					</Section>
				)}
				{profile.neighbours.length > 0 && (
					<AreaNeighbours profile={profile} />
				)}
				<AreaData
					profile={profile}
					council={council}
					councilProfile={councilProfile}
				/>
				<AreaApi profile={profile} lastRelease={lastRelease} />
			</PlaceLayout>
		</>
	);
}
