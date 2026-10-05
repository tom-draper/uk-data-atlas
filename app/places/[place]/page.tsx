import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { ReactNode } from "react";
import Navigation from "@/components/Navigation";
import {
	Breadcrumbs,
	Card,
	Eyebrow,
	Pill,
	Sheet,
} from "@/components/docs/Page";
import PlaceMap from "@/components/places/PlaceMap";
import PlaceTimeline from "@/components/places/PlaceTimeline";
import {
	areaRequests,
	namedRequests,
	PLACE_OPERATIONS,
	type PlaceRequest,
} from "@/lib/places/api";
import {
	areaHref,
	countryOf,
	dateLabel,
	geographyName,
	geographyNoun,
	listNames,
	namedHref,
	namedKindName,
} from "@/lib/places/labels";
import {
	loadAreaProfile,
	loadAreaProfiles,
	loadNamedProfile,
	PLACE_INDEX,
	placeEntry,
} from "@/lib/places/load";
import {
	isAreaCode,
	releaseLabel,
	type AreaGroup,
	type AreaProfile,
	type DatasetCoverage,
	type NamedProfile,
	type NamedRef,
} from "@/lib/places/profile";
import { pageMetadata } from "@/lib/site";

type Params = Promise<{ place: string }>;

/**
 * Councils, constituencies and named places are built ahead of time; the
 * many thousands of wards, and areas no longer in use, render on first visit.
 */
export function generateStaticParams() {
	return [
		...PLACE_INDEX.areas
			.filter(
				([, , geography, , , lastYear]) =>
					geography !== "ward" && lastYear === null,
			)
			.map(([place]) => ({ place })),
		...PLACE_INDEX.named.map(([place]) => ({ place })),
	];
}

async function resolvePlace(params: Params) {
	const id = decodeURIComponent((await params).place);
	if (!placeEntry(id)) {
		// Codes are written in capitals; a slug is written in lower case.
		const canonical = isAreaCode(id.toUpperCase())
			? id.toUpperCase()
			: id.toLowerCase();
		if (canonical !== id && placeEntry(canonical))
			permanentRedirect(`/places/${canonical}`);
		notFound();
	}
	const profile = isAreaCode(id)
		? await loadAreaProfile(id)
		: await loadNamedProfile(id);
	if (!profile) notFound();
	return profile;
}

function areaSummary(profile: AreaProfile) {
	const noun = geographyNoun(profile.geography);
	const council = profile.parents.find(
		(parent) => parent.geography === "localAuthority",
	);
	const country = countryOf(profile.code);
	const where = [council?.name, country].filter(Boolean).join(", ");
	const releases = PLACE_INDEX.releases[profile.geography];
	const first = releaseLabel(releases[profile.releases[0]!]!);
	const last = releaseLabel(releases[profile.releases.at(-1)!]!);
	return profile.current
		? `${profile.name} is a ${noun}${where ? ` in ${where}` : ""}, published in boundary releases since ${first}.`
		: `${profile.name} was a ${noun}${where ? ` in ${where}` : ""}, published in boundary releases from ${first} to ${last}.`;
}

export async function generateMetadata({
	params,
}: {
	params: Params;
}): Promise<Metadata> {
	const profile = await resolvePlace(params);
	if (profile.type === "named")
		return pageMetadata({
			subject: `${profile.label}: ${namedKindName(profile.kind).toLowerCase()}`,
			description: `${profile.label}, a ${namedKindName(profile.kind).toLowerCase()} of ${profile.members.filter((member) => member.current).length} UK local authorities: its members, history, map and the API requests that return them.`,
			path: `/places/${profile.id}`,
		});
	return pageMetadata({
		subject: `${profile.name} (${profile.code}), ${geographyNoun(profile.geography)}`,
		description: `${areaSummary(profile)} Its boundary history, the areas it sits within and borders, and the datasets published for it.`,
		path: `/places/${profile.code}`,
	});
}

const linkClass =
	"text-slate-800 underline decoration-slate-300 underline-offset-[3px] hover:decoration-slate-700";

function Section({
	id,
	title,
	children,
}: {
	id: string;
	title: string;
	children: ReactNode;
}) {
	return (
		<section id={id} className="mt-10 scroll-mt-24">
			<h2 className="text-[20px] font-semibold tracking-tight text-slate-900">
				{title}
			</h2>
			<div className="mt-3 text-[15px] leading-relaxed text-slate-600">
				{children}
			</div>
		</section>
	);
}

function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
	return (
		<dl
			className={`mt-6 grid grid-cols-2 gap-x-6 gap-y-4 ${items.length > 4 ? "sm:grid-cols-3 xl:grid-cols-5" : "sm:grid-cols-4"}`}
		>
			{items.map((item) => (
				<div key={item.label} className="min-w-0">
					<dt className="text-[13px] text-slate-500">{item.label}</dt>
					<dd className="mt-0.5 text-[15px] font-medium text-slate-900">
						{item.value}
					</dd>
				</div>
			))}
		</dl>
	);
}

function PlaceLink({ href, children }: { href?: string; children: ReactNode }) {
	return href ? (
		<Link href={href} className={linkClass}>
			{children}
		</Link>
	) : (
		<span className="text-slate-800">{children}</span>
	);
}

/** Rows of label and value, for what a place sits within. */
function Rows({ rows }: { rows: { label: string; value: ReactNode }[] }) {
	return (
		<Card className="divide-y divide-slate-900/[0.06]">
			{rows.map((row) => (
				<div
					key={row.label}
					className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-4 py-2.5"
				>
					<span className="w-[190px] shrink-0 text-[13px] text-slate-500">
						{row.label}
					</span>
					<span className="min-w-0 flex-1 text-[15px]">
						{row.value}
					</span>
				</div>
			))}
		</Card>
	);
}

function NamedLinks({ places }: { places: NamedRef[] }) {
	return places.map((place, index) => (
		<span key={place.id}>
			{index > 0 && ", "}
			<PlaceLink href={namedHref(place)}>{place.label}</PlaceLink>
		</span>
	));
}

/** Named places grouped by kind, as rows. */
function namedRows(places: NamedRef[]) {
	const order = [
		"country",
		"region",
		"combined-authority",
		"county",
		"ceremonial-county",
		"historic-county",
		"editorial-grouping",
	];
	const kinds = [...new Set(places.map((place) => place.kind))].sort(
		(a, b) => order.indexOf(a) - order.indexOf(b),
	);
	return kinds.map((kind) => ({
		label: namedKindName(kind),
		value: (
			<NamedLinks
				places={places.filter((place) => place.kind === kind)}
			/>
		),
	}));
}

function AreaGroups({ groups }: { groups: AreaGroup[] }) {
	return (
		<div className="space-y-5">
			{groups.map((group) => (
				<div key={group.geography}>
					<p className="text-[14px] text-slate-500">
						{group.count.toLocaleString("en-GB")}{" "}
						{geographyNoun(group.geography, group.count !== 1)}, as
						of the {releaseLabel(group.release)} boundaries
					</p>
					{group.areas && (
						<ul className="mt-2 columns-2 gap-x-6 text-[14.5px] sm:columns-3">
							{group.areas.map((area) => (
								<li
									key={area.code}
									className="break-inside-avoid py-0.5"
								>
									<PlaceLink href={areaHref(area)}>
										{area.name}
									</PlaceLink>
								</li>
							))}
						</ul>
					)}
				</div>
			))}
		</div>
	);
}

function Datasets({ datasets }: { datasets: DatasetCoverage[] }) {
	return (
		<ul className="divide-y divide-slate-900/[0.06]">
			{datasets.map((dataset) => (
				<li
					key={dataset.slug}
					className="flex flex-wrap items-baseline justify-between gap-x-4 py-2"
				>
					<Link
						href={`/datasets#${dataset.slug}`}
						className={linkClass}
					>
						{dataset.title}
					</Link>
					<span className="text-[13px] text-slate-500">
						{yearsLabel(dataset.years)}
					</span>
				</li>
			))}
		</ul>
	);
}

/** Newest first: `2023`, `2021 and 2023`, `2016 to 2023 (6 years)`. */
function yearsLabel(years: number[]) {
	const sorted = [...years].sort((a, b) => a - b);
	if (sorted.length <= 2) return listNames(sorted.map(String));
	return `${sorted[0]} to ${sorted.at(-1)} (${sorted.length} years)`;
}

function ApiRequests({ requests }: { requests: PlaceRequest[] }) {
	return (
		<Card className="overflow-hidden">
			<ul className="divide-y divide-slate-900/[0.06]">
				{requests.map((request) => (
					<li key={request.path} className="px-4 py-3">
						<div className="flex flex-wrap items-baseline justify-between gap-x-4">
							<span className="text-[14px] font-medium text-slate-800">
								{request.label}
							</span>
							<Link
								href={PLACE_OPERATIONS[request.operationId]}
								className="text-[13px] text-slate-500 hover:text-slate-900"
							>
								Docs
							</Link>
						</div>
						<code className="mt-1 block overflow-x-auto font-mono text-[12.5px] whitespace-nowrap text-slate-600">
							<span className="mr-2 font-semibold text-emerald-700">
								GET
							</span>
							{request.path}
						</code>
					</li>
				))}
			</ul>
		</Card>
	);
}

function Header({
	trail,
	eyebrow,
	title,
	lede,
	pill,
}: {
	trail: { label: string; href?: string }[];
	eyebrow: string;
	title: string;
	lede: ReactNode;
	pill: ReactNode;
}) {
	return (
		<>
			<Breadcrumbs trail={trail} />
			<Eyebrow>{eyebrow}</Eyebrow>
			<div className="flex flex-wrap items-center gap-3">
				<h1 className="text-[32px] leading-[1.15] font-semibold tracking-tight text-slate-900 sm:text-[38px]">
					{title}
				</h1>
				{pill}
			</div>
			<p className="mt-3 max-w-[760px] text-[17px] leading-[1.7] text-slate-600">
				{lede}
			</p>
		</>
	);
}

async function AreaPage({ profile }: { profile: AreaProfile }) {
	const releases = PLACE_INDEX.releases[profile.geography];
	const lastRelease = releases[profile.releases.at(-1)!]!;
	const council = profile.parents.find(
		(parent) => parent.geography === "localAuthority",
	);
	// A ward's named places and wider data are its council's.
	const councilProfile = council
		? await loadAreaProfile(council.code)
		: undefined;
	const namedPlaces =
		profile.namedPlaces ?? councilProfile?.namedPlaces ?? [];
	const otherParents = profile.parents.filter(
		(parent) => parent.geography !== "localAuthority",
	);
	const country = countryOf(profile.code);
	const firstYear = releases[profile.releases[0]!]!.slice(0, 4);
	const lastYear = lastRelease.slice(0, 4);

	return (
		<>
			<Header
				trail={[
					{ label: "Places", href: "/places" },
					...(council
						? [{ label: council.name, href: areaHref(council) }]
						: []),
					{ label: profile.name },
				]}
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
			<div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
				<div className="min-w-0">
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
							/>
						</Card>
					)}
					<p className="mt-2 text-[12.5px] text-slate-500">
						The {releaseLabel(lastRelease)} boundary, generalised to
						about 100 m.
					</p>
					<Facts
						items={[
							{ label: "Code", value: profile.code },
							{
								label: "Kind",
								value: geographyName(profile.geography),
							},
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
														{
															profile.population
																.year
														}{" "}
														estimate
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

					<Section id="within" title="Where it sits">
						<Rows
							rows={[
								...(council
									? [
											{
												label: "Local authority",
												value: (
													<PlaceLink
														href={areaHref(council)}
													>
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
								!namedPlaces.some(
									(place) => place.kind === "country",
								)
									? [{ label: "Country", value: country }]
									: []),
							]}
						/>
						{profile.geography === "ward" && (
							<p className="mt-3 text-[13px] text-slate-500">
								A ward is placed in the constituency holding
								most of it, so a ward on a constituency boundary
								is listed in one.
							</p>
						)}
					</Section>

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
						<Section id="neighbours" title="Neighbours">
							<p>
								{profile.neighbours.length}{" "}
								{geographyNoun(
									profile.geography,
									profile.neighbours.length !== 1,
								)}{" "}
								{profile.neighbours.length === 1
									? "shares"
									: "share"}{" "}
								a border with {profile.name}, longest border
								first.
							</p>
							<ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
								{profile.neighbours.map((neighbour) => (
									<li key={neighbour.code}>
										<PlaceLink
											href={`/places/${neighbour.code}`}
										>
											{neighbour.name}
										</PlaceLink>{" "}
										<span className="text-[13px] text-slate-500">
											{(
												neighbour.sharedBorderM / 1000
											).toFixed(1)}{" "}
											km
										</span>
									</li>
								))}
							</ul>
						</Section>
					)}

					<Section id="data" title="Data published for it">
						{profile.datasets.length > 0 ? (
							<>
								<p>
									{profile.datasets.length} of the
									Atlas&apos;s datasets publish figures for{" "}
									{profile.name} itself.
								</p>
								<Datasets datasets={profile.datasets} />
							</>
						) : (
							<p>
								None of the Atlas&apos;s datasets publish
								figures for {profile.name} under this code.
							</p>
						)}
						{councilProfile &&
							councilProfile.datasets.length > 0 && (
								<>
									<p className="mt-6">
										And {councilProfile.datasets.length}{" "}
										more for{" "}
										<PlaceLink href={areaHref(council!)}>
											{councilProfile.name}
										</PlaceLink>
										, the local authority it sits in.
									</p>
									<Datasets
										datasets={councilProfile.datasets}
									/>
								</>
							)}
						{(profile.mapsSlug ?? councilProfile?.mapsSlug) && (
							<p className="mt-6">
								<Link
									href={`/maps/${profile.mapsSlug ?? councilProfile?.mapsSlug}`}
									className={linkClass}
								>
									See every map of{" "}
									{profile.mapsSlug
										? profile.name
										: councilProfile?.name}
								</Link>
							</p>
						)}
					</Section>

					<Section id="api" title="Ask the API">
						<p className="mb-4">
							Everything on this page comes from the UK Data Atlas
							API&apos;s geography resolver. These requests return
							it, for the {releaseLabel(lastRelease)} release.
						</p>
						<ApiRequests
							requests={areaRequests(profile, lastRelease)}
						/>
					</Section>
				</div>
				<aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
					<Card className="p-5">
						<PlaceTimeline profile={profile} releases={releases} />
					</Card>
				</aside>
			</div>
		</>
	);
}

/** Wards are listed on a named place's page up to this many. */
const LISTED_WARDS = 2500;

async function NamedPage({ profile }: { profile: NamedProfile }) {
	const current = profile.members.filter((member) => member.current);
	// Each member council's current wards, for places small enough to list
	// them all: every region and county, but not England or the UK.
	const councils = await loadAreaProfiles(
		current.map((member) => member.code),
	);
	const wardsByCouncil = current
		.map((member) => ({
			council: member,
			wards:
				councils
					.get(member.code)
					?.children.find((group) => group.geography === "ward")
					?.areas ?? [],
		}))
		.filter(({ wards }) => wards.length > 0);
	const wardCount = wardsByCouncil.reduce(
		(total, { wards }) => total + wards.length,
		0,
	);
	const former = profile.members.filter((member) => !member.current);
	const changes = profile.members
		.flatMap((member) => [
			...(member.from
				? [{ date: member.from, joined: true, member }]
				: []),
			...(member.to ? [{ date: member.to, joined: false, member }] : []),
		])
		.sort((a, b) => b.date.localeCompare(a.date));
	const kind = namedKindName(profile.kind).toLowerCase();

	return (
		<>
			<Header
				trail={[
					{ label: "Places", href: "/places" },
					...profile.within
						.filter((place) => place.kind === "country")
						.slice(0, 1)
						.map((place) => ({
							label: place.label,
							href: namedHref(place),
						})),
					{ label: profile.label },
				]}
				eyebrow={namedKindName(profile.kind)}
				title={profile.label}
				lede={`${profile.label} is a ${kind} made up of ${current.length} local ${current.length === 1 ? "authority" : "authorities"}. ${profile.source}`}
				pill={null}
			/>
			<div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
				<div className="min-w-0">
					{Object.keys(profile.outlines).length > 0 && (
						<Card className="p-1.5">
							<PlaceMap
								shapes={current
									.filter(
										(member) =>
											profile.outlines[member.code],
									)
									.map((member) => ({
										code: member.code,
										name: member.name,
										outline: profile.outlines[member.code]!,
										href: `/places/${member.code}`,
									}))}
								bbox={profile.bbox}
								label={profile.label}
							/>
						</Card>
					)}
					<p className="mt-2 text-[12.5px] text-slate-500">
						Its local authorities today. Select one to open its
						page.
					</p>

					<Section id="members" title="Local authorities">
						<ul className="columns-2 gap-x-6 text-[14.5px] sm:columns-3">
							{current.map((member) => (
								<li
									key={member.code}
									className="break-inside-avoid py-0.5"
								>
									<PlaceLink href={`/places/${member.code}`}>
										{member.name}
									</PlaceLink>
								</li>
							))}
						</ul>
						{former.length > 0 && (
							<>
								<p className="mt-5 text-[14px] text-slate-500">
									Former members
								</p>
								<ul className="mt-2 columns-2 gap-x-6 text-[14.5px] sm:columns-3">
									{former.map((member) => (
										<li
											key={member.code}
											className="break-inside-avoid py-0.5"
										>
											<PlaceLink
												href={`/places/${member.code}`}
											>
												{member.name}
											</PlaceLink>{" "}
											<span className="text-[12.5px] text-slate-500">
												to {dateLabel(member.to!)}
											</span>
										</li>
									))}
								</ul>
							</>
						)}
					</Section>

					{wardCount > 0 && wardCount <= LISTED_WARDS && (
						<Section id="wards" title="Wards">
							<p>
								{wardCount.toLocaleString("en-GB")} wards, by
								local authority.
							</p>
							{wardsByCouncil.map(({ council, wards }) => (
								<div key={council.code} className="mt-5">
									<h3 className="text-[15px] font-semibold text-slate-900">
										<PlaceLink
											href={`/places/${council.code}`}
										>
											{council.name}
										</PlaceLink>{" "}
										<span className="text-[13px] font-normal text-slate-400">
											{wards.length}
										</span>
									</h3>
									<ul className="mt-1.5 columns-2 gap-x-6 text-[14px] sm:columns-3">
										{wards.map((ward) => (
											<li
												key={ward.code}
												className="break-inside-avoid py-0.5"
											>
												<PlaceLink
													href={`/places/${ward.code}`}
												>
													{ward.name}
												</PlaceLink>
											</li>
										))}
									</ul>
								</div>
							))}
						</Section>
					)}

					{(profile.within.length > 0 ||
						profile.contains.length > 0) && (
						<Section id="related" title="Related places">
							<Rows
								rows={[
									...(profile.within.length > 0
										? [
												{
													label: "Within",
													value: (
														<NamedLinks
															places={
																profile.within
															}
														/>
													),
												},
											]
										: []),
									...namedRows(profile.contains),
								]}
							/>
						</Section>
					)}

					{profile.mapsSlug && (
						<Section id="data" title="Data for it">
							<p>
								<Link
									href={`/maps/${profile.mapsSlug}`}
									className={linkClass}
								>
									See every map of {profile.label}
								</Link>
								, with its councils, wards or constituencies
								coloured by the Atlas&apos;s datasets.
							</p>
						</Section>
					)}

					<Section id="api" title="Ask the API">
						<p className="mb-4">
							The API holds {profile.label} as a named location,
							with each member dated, so you can add up data over
							it or list the areas inside it.
						</p>
						<ApiRequests requests={namedRequests(profile)} />
					</Section>
				</div>
				<aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
					<Card className="p-5">
						<h2 className="text-[18px] font-semibold tracking-tight text-slate-900">
							History
						</h2>
						{changes.length > 0 ? (
							<ol className="relative mt-5 border-l border-slate-900/10 pl-5">
								{changes.map(({ date, joined, member }) => (
									<li
										key={`${member.code}-${joined}`}
										className="relative pb-5 last:pb-0"
									>
										<span
											aria-hidden
											className={`absolute top-[6px] -left-[25px] h-[9px] w-[9px] rounded-full ring-4 ring-[#f3f3f1] ${joined ? "bg-blue-600" : "bg-rose-500"}`}
										/>
										<p className="text-[12px] font-medium tracking-wide text-slate-500 uppercase">
											{dateLabel(date)}
										</p>
										<p className="mt-0.5 text-[14px] leading-relaxed text-slate-600">
											<PlaceLink
												href={`/places/${member.code}`}
											>
												{member.name}
											</PlaceLink>{" "}
											{joined ? "joined" : "left"}.
										</p>
									</li>
								))}
							</ol>
						) : (
							<p className="mt-3 text-[14px] leading-relaxed text-slate-600">
								Its membership hasn&apos;t changed across the
								boundary releases the API holds.
							</p>
						)}
					</Card>
				</aside>
			</div>
		</>
	);
}

export default async function PlacePage({ params }: { params: Params }) {
	const profile = await resolvePlace(params);
	return (
		<div className="min-h-screen bg-[#f3f3f1] text-slate-700">
			<Navigation />
			<main className="mx-auto max-w-[1480px] px-3 sm:px-4">
				<Sheet>
					{profile.type === "area" ? (
						<AreaPage profile={profile} />
					) : (
						<NamedPage profile={profile} />
					)}
				</Sheet>
			</main>
		</div>
	);
}
