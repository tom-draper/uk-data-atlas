import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Navigation from "@/components/Navigation";
import { Sheet } from "@/components/docs/Page";
import { PostcodePlacePage } from "@/components/places/PostcodePlacePage";
import { loadPlaceIndex } from "@/lib/places/load";
import { compactUnit, postcodeHref } from "@/lib/places/postcodeUnit";
import {
	loadPostcodeDistricts,
	normaliseDistrict,
} from "@/lib/places/postcodes";
import { pageMetadata } from "@/lib/site";

type Params = Promise<{ district: string }>;

/** Districts render on demand, as there are some three thousand. */
export function generateStaticParams() {
	return [];
}

async function resolveDistrict(params: Params) {
	const id = decodeURIComponent((await params).district);
	const data = await loadPostcodeDistricts();
	const canonical = normaliseDistrict(id);
	const entry = data?.districts[canonical];
	// A whole postcode typed into the address, "/places/postcodes/WA35DW".
	const unit = entry ? undefined : compactUnit(canonical);
	if (unit) permanentRedirect(postcodeHref(unit));
	if (!data || !entry) notFound();
	if (canonical !== id) permanentRedirect(`/places/postcodes/${canonical}`);
	return { district: canonical, entry, source: data.source };
}

export async function generateMetadata({
	params,
}: {
	params: Params;
}): Promise<Metadata> {
	const { district, entry } = await resolveDistrict(params);
	const names = new Map(
		(await loadPlaceIndex()).areas.map(([code, name]) => [code, name]),
	);
	const council = names.get(entry.areas.localAuthority[0]?.[0] ?? "");
	return pageMetadata({
		subject: `${district} postcode district${council ? `, ${council}` : ""}`,
		description: `${district} has ${entry.live.toLocaleString("en-GB")} live postcodes in ${entry.sectors.length} sectors${council ? ` in ${council}` : ""}. The wards, councils and constituencies its postcodes fall in, and nearby districts.`,
		path: `/places/postcodes/${district}`,
	});
}

export default async function PostcodeDistrictPage({
	params,
}: {
	params: Params;
}) {
	const { district, entry, source } = await resolveDistrict(params);
	return (
		<div className="min-h-screen bg-[#f3f3f1] text-slate-700">
			<Navigation />
			<main className="mx-auto max-w-[1480px] px-3 sm:px-4">
				<Sheet>
					<PostcodePlacePage
						name={district}
						district={district}
						sectors={entry.sectors}
						entry={entry}
						source={source}
					/>
				</Sheet>
			</main>
		</div>
	);
}
