import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Navigation from "@/components/Navigation";
import { Sheet } from "@/components/docs/Page";
import { AreaPlacePage } from "@/components/places/AreaPlacePage";
import { NamedPlacePage } from "@/components/places/NamedPlacePage";
import { geographyNoun, namedKindName } from "@/lib/places/labels";
import {
	loadAreaProfile,
	loadNamedProfile,
	PLACE_INDEX,
	placeEntry,
} from "@/lib/places/load";
import { isAreaCode } from "@/lib/places/profile";
import { areaSummary } from "@/lib/places/summary";
import { pageMetadata } from "@/lib/site";

type Params = Promise<{ place: string }>;

/** Councils, constituencies and named places are built ahead of time. */
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

export default async function PlacePage({ params }: { params: Params }) {
	const profile = await resolvePlace(params);
	return (
		<div className="min-h-screen bg-[#f3f3f1] text-slate-700">
			<Navigation />
			<main className="mx-auto max-w-[1480px] px-3 sm:px-4">
				<Sheet>
					{profile.type === "area" ? (
						<AreaPlacePage profile={profile} />
					) : (
						<NamedPlacePage profile={profile} />
					)}
				</Sheet>
			</main>
		</div>
	);
}
