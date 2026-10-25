import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import Navigation from "@/components/Navigation";
import { Sheet } from "@/components/docs/Page";
import { PostcodePlacePage } from "@/components/places/PostcodePlacePage";
import { PostcodeUnitPage } from "@/components/places/PostcodeUnitPage";
import { loadPlaceIndex } from "@/lib/places/load";
import {
	compactUnit,
	lookupPostcodeUnit,
	postcodeHref,
} from "@/lib/places/postcodeUnit";
import {
	loadNeighbourhoods,
	loadPostcodeDistricts,
	loadPostcodeSectors,
	normaliseDistrict,
	sectorHref,
} from "@/lib/places/postcodes";
import { pageMetadata } from "@/lib/site";

/** "1" for the LS6 1 sector, or "1AA" for the LS6 1AA postcode. */
type Params = Promise<{ district: string; inward: string }>;

/**
 * Sectors and postcodes render on demand, as there are some eleven thousand
 * sectors and 1.7 million postcodes.
 */
export function generateStaticParams() {
	return [];
}

const lookup = cache(lookupPostcodeUnit);

async function resolve(params: Params) {
	const { district: rawDistrict, inward: rawInward } = await params;
	const district = normaliseDistrict(decodeURIComponent(rawDistrict));
	const inward = normaliseDistrict(decodeURIComponent(rawInward));
	const canonical = district === rawDistrict && inward === rawInward;
	const [districts, sectors] = await Promise.all([
		loadPostcodeDistricts(),
		loadPostcodeSectors(),
	]);
	if (!districts || !sectors) notFound();

	if (/^\d$/.test(inward)) {
		const name = `${district} ${inward}`;
		const parent = districts.districts[district];
		const entry = sectors.sectors[name];
		if (!parent || !entry) notFound();
		if (!canonical) permanentRedirect(sectorHref(name));
		return {
			kind: "sector" as const,
			name,
			district,
			parent,
			entry,
			source: sectors.source,
		};
	}

	const compact = compactUnit(`${district}${inward}`);
	const unit = compact ? lookup(compact) : undefined;
	if (!unit) notFound();
	if (!canonical) permanentRedirect(postcodeHref(unit.postcode));
	return {
		kind: "unit" as const,
		unit,
		sector: sectors.sectors[unit.sector],
		source: districts.source,
	};
}

export async function generateMetadata({
	params,
}: {
	params: Params;
}): Promise<Metadata> {
	const page = await resolve(params);
	const names = new Map(
		(await loadPlaceIndex()).areas.map(([code, label]) => [code, label]),
	);
	if (page.kind === "sector") {
		const { name, entry } = page;
		const council = names.get(entry.areas.localAuthority[0]?.[0] ?? "");
		const ward = names.get(entry.areas.ward[0]?.[0] ?? "");
		return pageMetadata({
			subject: `${name} postcode sector${council ? `, ${council}` : ""}`,
			description: `${name} has ${entry.live.toLocaleString("en-GB")} live postcodes${ward ? `, mostly in ${ward} ward` : ""}${council ? `, ${council}` : ""}. Its wards, constituency, deprivation and nearby sectors.`,
			path: sectorHref(name),
		});
	}
	const { unit } = page;
	const council = names.get(unit.areas.localAuthority ?? "");
	const ward = names.get(unit.areas.ward ?? "");
	const constituency = names.get(unit.areas.constituency ?? "");
	return pageMetadata({
		subject: `${unit.postcode}${council ? `, ${council}` : ""}`,
		description: `${unit.postcode} is ${unit.terminated ? "a terminated postcode" : "a postcode"}${ward ? ` in ${ward} ward` : ""}${council ? `, ${council}` : ""}${constituency ? `, in the ${constituency} constituency` : ""}. Its location, areas, neighbourhood deprivation and nearby postcodes.`,
		path: postcodeHref(unit.postcode),
		// A terminated postcode is kept for anyone following an old link,
		// but no longer names any address worth searching for.
		...(unit.terminated ? { robots: { index: false, follow: true } } : {}),
	});
}

export default async function PostcodeInwardPage({
	params,
}: {
	params: Params;
}) {
	const page = await resolve(params);
	return (
		<div className="min-h-screen bg-[#f3f3f1] text-slate-700">
			<Navigation />
			<main className="mx-auto max-w-[1480px] px-3 sm:px-4">
				<Sheet>
					{page.kind === "sector" ? (
						<PostcodePlacePage
							name={page.name}
							district={page.district}
							sectors={page.parent.sectors}
							entry={page.entry}
							source={page.source}
						/>
					) : (
						<PostcodeUnitPage
							unit={page.unit}
							sector={page.sector}
							neighbourhoods={await loadNeighbourhoods()}
							source={page.source}
						/>
					)}
				</Sheet>
			</main>
		</div>
	);
}
