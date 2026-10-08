import Link from "next/link";
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
	countryOf,
	geographyName,
	geographyNoun,
} from "@/lib/places/labels";
import { loadAreaProfile, PLACE_INDEX } from "@/lib/places/load";
import { releaseLabel, type AreaProfile } from "@/lib/places/profile";
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
	// A constituency's region is that of a council it sits in or overlaps.
	const regionCouncil =
		profile.geography === "constituency"
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
	const namedPlaces =
		profile.namedPlaces ?? councilProfile?.namedPlaces ?? [];
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

function AreaFacts({
	profile,
	releases,
}: {
	profile: AreaProfile;
	releases: string[];
}) {
	const firstYear = releases[profile.releases[0]!]!.slice(0, 4);
	const lastYear = releases[profile.releases.at(-1)!]!.slice(0, 4);
	return (
		<Facts
			items={[
				{ label: "Code", value: profile.code },
				{ label: "Kind", value: geographyName(profile.geography) },
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
											className="block text-[12.5px] font-normal text-slate-500 hover:text-slate-800"
										>
											Mid-
											{profile.population.year} estimate
										</Link>
									</>
								),
							},
						]
					: []),
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
				{geographyNoun(
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

export async function AreaPlacePage({ profile }: { profile: AreaProfile }) {
	const releases = PLACE_INDEX.releases[profile.geography];
	const lastRelease = releases[profile.releases.at(-1)!]!;
	const { council, councilProfile, region, namedPlaces } =
		await loadAreaContext(profile);

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
				eyebrow={`${geographyName(profile.geography)} · ${profile.code}`}
				title={profile.name}
				lede={areaSummary(profile)}
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
				<AreaFacts profile={profile} releases={releases} />
				<AreaWithin
					profile={profile}
					council={council}
					namedPlaces={namedPlaces}
				/>
				{profile.children.length > 0 && (
					<Section id="contains" title="What it contains">
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
