import Link from "next/link";
import { Card } from "@/components/docs/Page";
import PlaceMap from "@/components/places/PlaceMap";
import {
	ApiRequests,
	linkClass,
	NamedLinks,
	namedRows,
	PlaceHeader,
	PlaceLayout,
	PlaceLink,
	Rows,
	Section,
} from "@/components/places/PlaceUi";
import {
	placeTrail,
	regionIn,
	UNITED_KINGDOM,
} from "@/components/places/trail";
import { namedRequests } from "@/lib/places/api";
import { dateLabel, namedKindName } from "@/lib/places/labels";
import { loadAreaProfiles } from "@/lib/places/load";
import type { NamedProfile } from "@/lib/places/profile";

/** Wards are listed on a named place's page up to this many. */
const LISTED_WARDS = 2500;

type Member = NamedProfile["members"][number];

/** Each member council's current wards, for places small enough to list them. */
async function loadWardsByCouncil(current: Member[]) {
	// Every region and county, but not England or the UK.
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
	return { wardsByCouncil, wardCount };
}

/** Joins and leaves across the members, newest first. */
function membershipChanges(members: Member[]) {
	return members
		.flatMap((member) => [
			...(member.from
				? [{ date: member.from, joined: true, member }]
				: []),
			...(member.to ? [{ date: member.to, joined: false, member }] : []),
		])
		.sort((a, b) => b.date.localeCompare(a.date));
}

function NamedMap({
	profile,
	current,
}: {
	profile: NamedProfile;
	current: Member[];
}) {
	return (
		<>
			{Object.keys(profile.outlines).length > 0 && (
				<Card className="p-1.5">
					<PlaceMap
						shapes={current
							.filter((member) => profile.outlines[member.code])
							.map((member) => ({
								code: member.code,
								name: member.name,
								outline: profile.outlines[member.code]!,
								href: `/places/${member.code}`,
							}))}
						bbox={profile.bbox}
						label={profile.label}
						geography={profile.memberGeography}
					/>
				</Card>
			)}
			<p className="mt-2 text-[12.5px] text-slate-500">
				Its local authorities today. Select one to open its page.
			</p>
		</>
	);
}

function NamedMembers({
	current,
	former,
}: {
	current: Member[];
	former: Member[];
}) {
	return (
		<Section id="members" title="Local authorities">
			<ul className="columns-2 gap-x-6 text-[14.5px] sm:columns-3">
				{current.map((member) => (
					<li key={member.code} className="break-inside-avoid py-0.5">
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
								<PlaceLink href={`/places/${member.code}`}>
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
	);
}

function NamedWards({
	wardsByCouncil,
	wardCount,
}: Awaited<ReturnType<typeof loadWardsByCouncil>>) {
	return (
		<Section id="wards" title="Wards">
			<p>
				{wardCount.toLocaleString("en-GB")} wards, by local authority.
			</p>
			{wardsByCouncil.map(({ council, wards }) => (
				<div key={council.code} className="mt-5">
					<h3 className="text-[15px] font-semibold text-slate-900">
						<PlaceLink href={`/places/${council.code}`}>
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
								<PlaceLink href={`/places/${ward.code}`}>
									{ward.name}
								</PlaceLink>
							</li>
						))}
					</ul>
				</div>
			))}
		</Section>
	);
}

function NamedRelated({ profile }: { profile: NamedProfile }) {
	return (
		<Section id="related" title="Related places">
			<Rows
				rows={[
					...(profile.within.length > 0
						? [
								{
									label: "Within",
									value: (
										<NamedLinks places={profile.within} />
									),
								},
							]
						: []),
					...namedRows(profile.contains),
				]}
			/>
		</Section>
	);
}

function NamedData({ profile }: { profile: NamedProfile }) {
	return (
		<Section id="data" title="Data for it">
			<p>
				<Link href={`/maps/${profile.mapsSlug}`} className={linkClass}>
					See every map of {profile.label}
				</Link>
				, with its councils, wards or constituencies coloured by the
				Atlas&apos;s datasets.
			</p>
		</Section>
	);
}

function NamedApi({ profile }: { profile: NamedProfile }) {
	return (
		<Section id="api" title="Ask the API">
			<p className="mb-4">
				The API holds {profile.label} as a named location, with each
				member dated, so you can add up data over it or list the areas
				inside it.
			</p>
			<ApiRequests requests={namedRequests(profile)} />
		</Section>
	);
}

/** The side card: when each member joined or left. */
function MembershipHistory({
	changes,
}: {
	changes: ReturnType<typeof membershipChanges>;
}) {
	return (
		<>
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
								<PlaceLink href={`/places/${member.code}`}>
									{member.name}
								</PlaceLink>{" "}
								{joined ? "joined" : "left"}.
							</p>
						</li>
					))}
				</ol>
			) : (
				<p className="mt-3 text-[14px] leading-relaxed text-slate-600">
					Its membership hasn&apos;t changed across the boundary
					releases the API holds.
				</p>
			)}
		</>
	);
}

export async function NamedPlacePage({ profile }: { profile: NamedProfile }) {
	const current = profile.members.filter((member) => member.current);
	const former = profile.members.filter((member) => !member.current);
	const { wardsByCouncil, wardCount } = await loadWardsByCouncil(current);
	const kind = namedKindName(profile.kind).toLowerCase();

	return (
		<>
			<PlaceHeader
				path={`/places/${profile.id}`}
				place={{
					name: profile.label,
					...(Object.keys(profile.outlines).length > 0
						? { bbox: profile.bbox }
						: {}),
				}}
				trail={
					profile.id === UNITED_KINGDOM.id
						? [
								{ label: "Places", href: "/places" },
								{ label: profile.label },
							]
						: placeTrail(
								[
									profile.within.find(
										(place) =>
											place.kind === "country" &&
											place.id !== UNITED_KINGDOM.id,
									),
									regionIn(profile.within),
								],
								{ label: profile.label },
							)
				}
				eyebrow={namedKindName(profile.kind)}
				title={profile.label}
				lede={`${profile.label} is a ${kind} made up of ${current.length} local ${current.length === 1 ? "authority" : "authorities"}. ${profile.source}`}
				pill={null}
			/>
			<PlaceLayout
				aside={
					<MembershipHistory
						changes={membershipChanges(profile.members)}
					/>
				}
			>
				<NamedMap profile={profile} current={current} />
				<NamedMembers current={current} former={former} />
				{wardCount > 0 && wardCount <= LISTED_WARDS && (
					<NamedWards
						wardsByCouncil={wardsByCouncil}
						wardCount={wardCount}
					/>
				)}
				{(profile.within.length > 0 || profile.contains.length > 0) && (
					<NamedRelated profile={profile} />
				)}
				{profile.mapsSlug && <NamedData profile={profile} />}
				<NamedApi profile={profile} />
			</PlaceLayout>
		</>
	);
}
