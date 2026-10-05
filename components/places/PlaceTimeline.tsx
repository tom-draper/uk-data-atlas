import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import {
	areaHref,
	countryOf,
	dateLabel,
	geographyNoun,
	namedHref,
	namedKindName,
} from "@/lib/places/labels";
import {
	releaseCovers,
	releaseLabel,
	type AreaProfile,
	type AreaRef,
	type TimelineEvent,
} from "@/lib/places/profile";

const linkClass =
	"font-medium text-slate-800 underline decoration-slate-300 underline-offset-[3px] hover:decoration-slate-700";

function AreaLink({ area }: { area: AreaRef }) {
	const href = areaHref(area);
	return href ? (
		<Link href={href} className={linkClass}>
			{area.name}
		</Link>
	) : (
		<span className="font-medium text-slate-800">{area.name}</span>
	);
}

function Areas({ areas }: { areas: AreaRef[] }) {
	return areas.map((area, index) => (
		<Fragment key={`${area.release}/${area.code}`}>
			{index > 0 && (index === areas.length - 1 ? " and " : ", ")}
			<AreaLink area={area} />
		</Fragment>
	));
}

/** What an event says, in a sentence. */
function describe(
	event: TimelineEvent,
	profile: AreaProfile,
): { title: string; body: ReactNode } {
	const noun = geographyNoun(profile.geography);
	switch (event.kind) {
		case "first-published":
			return event.archiveStart
				? {
						title: "Earliest release held",
						body: `Already in use in ${releaseLabel(event.release)}, the oldest ${noun} release in the archive, so it may be older still.`,
					}
				: {
						title: "First published",
						body: `It first appears in the ${releaseLabel(event.release)} ${noun} boundaries.`,
					};
		case "formed": {
			const body = {
				"merged-from":
					event.areas.length > 1 ? (
						<>
							Formed by merging <Areas areas={event.areas} />.
						</>
					) : (
						<>
							Formed from <Areas areas={event.areas} />.
						</>
					),
				mixed: (
					<>
						Formed from parts of <Areas areas={event.areas} />.
					</>
				),
				"split-from": (
					<>
						Formed from part of <Areas areas={event.areas} />.
					</>
				),
				"equivalent-to": (
					<>
						A new code for the same ground as{" "}
						<Areas areas={event.areas} />.
					</>
				),
			}[event.relation] ?? (
				<>
					Took over from <Areas areas={event.areas} />.
				</>
			);
			return {
				title:
					event.relation === "equivalent-to" ? "Recoded" : "Formed",
				body,
			};
		}
		case "gained":
			return {
				title: "Boundary changed",
				body: (
					<>
						Took in ground from <Areas areas={event.areas} />.
					</>
				),
			};
		case "lost":
			return {
				title: "Boundary changed",
				body: (
					<>
						Some of its ground passed to{" "}
						<Areas areas={event.areas} />.
					</>
				),
			};
		case "renamed":
			return {
				title: "Renamed",
				body: `Renamed from ${event.from} to ${event.to}.`,
			};
		case "redrawn":
			return {
				title: "Boundary redrawn",
				body: `Its area changed from ${event.fromKm2.toFixed(2)} km² to ${event.toKm2.toFixed(2)} km², under the same code.`,
			};
		case "parent-changed": {
			const parent = geographyNoun(event.geography);
			if (!event.from || !event.to)
				return { title: `New ${parent}`, body: null };
			if (event.from.name === event.to.name)
				return {
					title:
						event.geography === "constituency"
							? "Constituency redrawn"
							: "Council recoded",
					body: (
						<>
							Still in <AreaLink area={event.to} />, which has a
							new code: {event.from.code} became {event.to.code}.
						</>
					),
				};
			return {
				title:
					event.geography === "constituency"
						? "New constituency"
						: "New council",
				body: (
					<>
						Moved from <AreaLink area={event.from} /> to{" "}
						<AreaLink area={event.to} />.
					</>
				),
			};
		}
		case "ended": {
			if (event.areas.length === 0)
				return {
					title: "No longer published",
					body: `It is not in the ${releaseLabel(event.release)} ${noun} boundaries, and no published lookup says what replaced it.`,
				};
			if (event.relation === "equivalent-to")
				return {
					title: "Recoded",
					body: (
						<>
							The same ground took a new code as{" "}
							<Areas areas={event.areas} />.
						</>
					),
				};
			return {
				title: event.areas.length > 1 ? "Split up" : "Replaced",
				body: (
					<>
						{event.areas.length > 1
							? "Its ground was divided between "
							: "Replaced by "}
						<Areas areas={event.areas} />.
					</>
				),
			};
		}
		case "joined":
		case "left":
			return {
				title: event.kind === "joined" ? "Joined" : "Left",
				body: (
					<>
						{event.kind === "joined" ? "Became part of " : "Left "}
						<Link
							href={namedHref(event.place)}
							className={linkClass}
						>
							{event.place.label}
						</Link>
						, a {namedKindName(event.place.kind).toLowerCase()}.
					</>
				),
			};
	}
}

const eventDate = (event: TimelineEvent) =>
	"date" in event ? dateLabel(event.date) : releaseLabel(event.release);

/**
 * Which releases of the geography hold the code: one mark per release, filled
 * where the area is published.
 */
function ReleaseStrip({
	profile,
	releases,
}: {
	profile: AreaProfile;
	releases: string[];
}) {
	const held = new Set(profile.releases.map((index) => releases[index]));
	const covering = releases.filter((release) =>
		releaseCovers(release, profile.code),
	);
	return (
		<div>
			<div className="flex gap-[3px]" aria-hidden>
				{covering.map((release) => (
					<span
						key={release}
						title={`${releaseLabel(release)}${held.has(release) ? "" : ", not published"}`}
						className={`h-5 flex-1 rounded-[2px] ${held.has(release) ? "bg-blue-600/80" : "bg-slate-900/[0.07]"}`}
					/>
				))}
			</div>
			<div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
				<span>{releaseLabel(covering[0]!)}</span>
				<span>{releaseLabel(covering.at(-1)!)}</span>
			</div>
			<p className="mt-2 text-[13px] text-slate-600">
				In {held.size} of the {covering.length}{" "}
				{geographyNoun(profile.geography)} releases the archive holds
				for {countryOf(profile.code) ?? "it"}.
			</p>
		</div>
	);
}

export default function PlaceTimeline({
	profile,
	releases,
}: {
	profile: AreaProfile;
	releases: string[];
}) {
	return (
		<div>
			<h2 className="text-[18px] font-semibold tracking-tight text-slate-900">
				History
			</h2>
			<div className="mt-4">
				<ReleaseStrip profile={profile} releases={releases} />
			</div>
			<ol className="relative mt-6 border-l border-slate-900/10 pl-5">
				{profile.timeline.map((event, index) => {
					const { title, body } = describe(event, profile);
					return (
						<li key={index} className="relative pb-6 last:pb-0">
							<span
								aria-hidden
								className={`absolute top-[6px] -left-[25px] h-[9px] w-[9px] rounded-full ring-4 ring-[#f3f3f1] ${event.kind === "ended" ? "bg-rose-500" : event.kind === "first-published" || event.kind === "formed" ? "bg-blue-600" : "bg-slate-400"}`}
							/>
							<p className="text-[12px] font-medium tracking-wide text-slate-500 uppercase">
								{eventDate(event)}
							</p>
							<p className="mt-0.5 text-[15px] font-semibold text-slate-900">
								{title}
							</p>
							{body && (
								<p className="mt-1 text-[14px] leading-relaxed text-slate-600">
									{body}
								</p>
							)}
						</li>
					);
				})}
			</ol>
			<p className="mt-6 text-[12px] leading-relaxed text-slate-500">
				Dates are the boundary releases each change first appears in,
				which can come a few months after it took effect.
			</p>
		</div>
	);
}
