import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navigation from "@/components/Navigation";
import { Breadcrumbs, Card, Sheet } from "@/components/docs/Page";
import {
	ATLAS_LOCATIONS,
	type AtlasLocation,
	atlasMapsFor,
	atlasMapTitle,
	findAtlasLocation,
	pageTitle,
} from "@/lib/atlas/pages";
import { atlasMapSections } from "@/lib/atlas/mapSections";
import { JsonLd, locationMapsJsonLd } from "@/lib/atlas/structuredData";

type Params = Promise<{ location: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
	return ATLAS_LOCATIONS.map((location) => ({ location: location.slug }));
}

async function resolveLocation(params: Params) {
	const location = findAtlasLocation((await params).location);
	if (!location) notFound();
	return location;
}

function placeName(location: AtlasLocation) {
	return location.name === "United Kingdom" ? "the UK" : location.name;
}

export async function generateMetadata({
	params,
}: {
	params: Params;
}): Promise<Metadata> {
	const location = await resolveLocation(params);
	const title = pageTitle(`Maps of ${placeName(location)}`);
	const description = `Interactive maps of ${placeName(location)}: election results, population, house prices, crime, deprivation, health and more, from official sources.`;
	const path = `/maps/${location.slug}`;
	return {
		title,
		description,
		alternates: { canonical: path },
		openGraph: { title, description, url: path },
		twitter: { title, description },
	};
}

const linkClass =
	"underline decoration-slate-300 underline-offset-[3px] hover:decoration-slate-700";

export default async function LocationMapsPage({ params }: { params: Params }) {
	const location = await resolveLocation(params);
	const maps = atlasMapsFor(location);
	const neighbours = ATLAS_LOCATIONS.filter(
		(other) =>
			other.slug !== location.slug &&
			other.countries.some((country) =>
				location.countries.includes(country),
			),
	);

	return (
		<div className="min-h-screen bg-[#f3f3f1] text-slate-700">
			<JsonLd
				data={locationMapsJsonLd(
					location,
					maps,
					`Maps of ${placeName(location)}`,
				)}
			/>
			<Navigation />
			<main className="mx-auto max-w-[1480px] px-3 sm:px-4">
				<Sheet>
					<Breadcrumbs
						trail={[
							{ label: "Maps", href: "/maps" },
							{ label: location.name },
						]}
					/>
					<div className="max-w-[760px]">
						<h1 className="text-[32px] leading-[1.15] font-semibold tracking-tight text-slate-900 sm:text-[38px]">
							Maps of {placeName(location)}
						</h1>
						<p className="mt-4 text-[17px] leading-[1.7] text-slate-600">
							{maps.length} interactive maps of{" "}
							{placeName(location)}, from official sources. Each
							opens in the atlas, coloured area by area, with
							charts summarising {placeName(location)} as a whole.
						</p>
					</div>

					{atlasMapSections(maps).map((section) => (
						<section key={section.title} className="mt-10">
							<h2 className="text-[22px] font-semibold tracking-tight text-slate-900">
								{section.title}
							</h2>
							<div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
								{section.maps.map((map) => (
									<Card key={map.slug} className="p-5">
										<h3 className="text-[16px] font-semibold text-slate-900">
											<Link
												href={`/atlas/${location.slug}/${map.slug}`}
												className={linkClass}
											>
												{atlasMapTitle(map)} in{" "}
												{placeName(location)}
											</Link>
										</h3>
										<p className="mt-1 text-[13px] text-slate-500">
											{map.source.source} ·{" "}
											{map.source.year} · by{" "}
											{map.areaNoun}
										</p>
										<p className="mt-3 text-[14px] leading-relaxed text-slate-600">
											{map.source.description}
										</p>
									</Card>
								))}
							</div>
						</section>
					))}

					<section className="mt-12">
						<h2 className="text-[22px] font-semibold tracking-tight text-slate-900">
							More places
						</h2>
						<ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[14px] text-slate-600">
							{neighbours.map((other) => (
								<li key={other.slug}>
									<Link
										href={`/maps/${other.slug}`}
										className={linkClass}
									>
										{other.name}
									</Link>
								</li>
							))}
						</ul>
					</section>
				</Sheet>
			</main>
		</div>
	);
}
