import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Navigation from "@/components/Navigation";
import { Sheet } from "@/components/docs/Page";
import { PostcodePlacePage } from "@/components/places/PostcodePlacePage";
import { loadPlaceIndex } from "@/lib/places/load";
import {
	loadPostcodeDistricts,
	loadPostcodeSectors,
	normaliseDistrict,
	sectorHref,
} from "@/lib/places/postcodes";
import { pageMetadata } from "@/lib/site";

type Params = Promise<{ district: string; sector: string }>;

/** Sectors render on demand, as there are some eleven thousand. */
export function generateStaticParams() {
	return [];
}

async function resolveSector(params: Params) {
	const { district: rawDistrict, sector: rawSector } = await params;
	const district = normaliseDistrict(decodeURIComponent(rawDistrict));
	const digit = decodeURIComponent(rawSector).trim();
	const name = `${district} ${digit}`;
	const [districts, sectors] = await Promise.all([
		loadPostcodeDistricts(),
		loadPostcodeSectors(),
	]);
	const parent = districts?.districts[district];
	const entry = sectors?.sectors[name];
	if (!sectors || !parent || !entry) notFound();
	if (district !== rawDistrict || digit !== rawSector)
		permanentRedirect(sectorHref(name));
	return { name, district, parent, entry, source: sectors.source };
}

export async function generateMetadata({
	params,
}: {
	params: Params;
}): Promise<Metadata> {
	const { name, entry } = await resolveSector(params);
	const names = new Map(
		(await loadPlaceIndex()).areas.map(([code, label]) => [code, label]),
	);
	const council = names.get(entry.areas.localAuthority[0]?.[0] ?? "");
	const ward = names.get(entry.areas.ward[0]?.[0] ?? "");
	return pageMetadata({
		subject: `${name} postcode sector${council ? `, ${council}` : ""}`,
		description: `${name} has ${entry.live.toLocaleString("en-GB")} live postcodes${ward ? `, mostly in ${ward} ward` : ""}${council ? `, ${council}` : ""}. Its wards, constituency, deprivation and nearby sectors.`,
		path: sectorHref(name),
	});
}

export default async function PostcodeSectorPage({
	params,
}: {
	params: Params;
}) {
	const { name, district, parent, entry, source } =
		await resolveSector(params);
	return (
		<div className="min-h-screen bg-[#f3f3f1] text-slate-700">
			<Navigation />
			<main className="mx-auto max-w-[1480px] px-3 sm:px-4">
				<Sheet>
					<PostcodePlacePage
						name={name}
						district={district}
						sectors={parent.sectors}
						entry={entry}
						source={source}
					/>
				</Sheet>
			</main>
		</div>
	);
}
