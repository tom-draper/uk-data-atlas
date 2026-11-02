import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Navigation from "@/components/Navigation";
import { Sheet } from "@/components/docs/Page";
import { AreaPlacePage } from "@/components/places/AreaPlacePage";
import { NamedPlacePage } from "@/components/places/NamedPlacePage";
import { areaKindName, namedKindName } from "@/lib/places/labels";
import {
	loadAreaProfile,
	loadNamedProfile,
	loadPlaceIndex,
	placeEntry,
} from "@/lib/places/load";
import { isAreaCode } from "@uk-data-atlas/catalogue/place-profile";
import { areaSummary } from "@/lib/places/summary";
import { pageMetadata, titleCase } from "@/lib/site";

type Params = Promise<{ place: string }>;

const ON_DEMAND = new Set(["ward", "parish"]);

/**
 * Councils, constituencies, towns and named places are built ahead of time;
 * wards and parishes, many thousands each, when first visited.
 */
export async function generateStaticParams() {
	const PLACE_INDEX = await loadPlaceIndex();
	return [
		...PLACE_INDEX.areas
			.filter(
				([, , geography, , , lastYear]) =>
					!ON_DEMAND.has(geography) && lastYear === null,
			)
			.map(([place]) => ({ place })),
		...PLACE_INDEX.named.map(([place]) => ({ place })),
	];
}

async function resolvePlace(params: Params) {
	const id = decodeURIComponent((await params).place);
	if (!(await placeEntry(id))) {
		// Codes are written in capitals; a slug is written in lower case.
		const canonical = isAreaCode(id.toUpperCase())
			? id.toUpperCase()
			: id.toLowerCase();
		if (canonical !== id && (await placeEntry(canonical)))
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
			subject: `${profile.label}: ${titleCase(namedKindName(profile.kind))}`,
			description: `${profile.label}, a ${namedKindName(profile.kind).toLowerCase()} of ${profile.members.filter((member) => member.current).length} UK local authorities: its members, history, map and the API requests that return them.`,
			path: `/places/${profile.id}`,
		});
	return pageMetadata({
		subject: `${profile.name} (${profile.code}), ${titleCase(areaKindName(profile))}`,
		description: `${await areaSummary(profile)} Its boundary history, the areas it sits within and borders, and the datasets published for it.`,
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
