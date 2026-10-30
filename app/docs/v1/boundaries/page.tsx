import { CardGrid, DocPage, H2, LinkCard, P } from "@/components/docs/Content";
import {
	loadCatalogue,
	releaseYears,
	releasesForGeography,
} from "@/lib/docs/catalogue";
import { GEOGRAPHIES, GEOGRAPHY_GROUPS } from "@/lib/docs/content/geographies";
import { dataPagesOnGeography } from "@/lib/docs/dataPages";
import { docsMetadata } from "@/lib/docs/metadata";
import { geographyHref } from "@/lib/docs/navigation";

export const metadata = docsMetadata(
	"Boundaries",
	"Boundaries for every kind of UK area in the UK Data Atlas API: local authorities, wards, constituencies, LSOAs, regions, health boards and more, as GeoJSON and vector tiles.",
	"/docs/v1/boundaries",
);

export default async function BoundariesPage() {
	const catalogue = await loadCatalogue();
	return (
		<DocPage
			href="/docs/v1/boundaries"
			eyebrow="Boundaries"
			title="Boundaries"
			lede="Every kind of area the Atlas holds boundaries for, from countries down to small neighbourhoods. Each page lists its boundary releases, how many areas they contain, and what data is published on them. The years on each card are the span of releases the Atlas holds."
			toc={GEOGRAPHY_GROUPS.map((group) => ({
				id: group.id,
				title: group.title,
			}))}
		>
			<P>
				New to boundaries and releases? Start with [Areas and
				boundaries](/docs/v1/concepts/areas).
			</P>
			{GEOGRAPHY_GROUPS.map((group) => (
				<section key={group.id}>
					<H2 id={group.id}>{group.title}</H2>
					<CardGrid>
						{Object.entries(GEOGRAPHIES)
							.filter(([, content]) => content.group === group.id)
							.map(([id, content]) => {
								const releases = releasesForGeography(
									catalogue,
									id,
								);
								const data = dataPagesOnGeography(
									id,
									catalogue,
								);
								const count = catalogue.areaCounts.get(
									`${id}/${releases[0]?.id}`,
								);
								return (
									<LinkCard
										key={id}
										href={geographyHref(id)}
										title={content.title}
									>
										{content.intro}
										<span className="mt-2 block text-[12.5px] text-slate-400">
											{[
												count !== undefined &&
													`${count.toLocaleString("en-GB")} areas`,
												releases.length === 1
													? `1 release, ${releaseYears(releases)}`
													: `${releases.length} releases, ${releaseYears(releases)}`,
												data.length > 0 &&
													`${data.length} data ${data.length === 1 ? "page" : "pages"}`,
											]
												.filter(Boolean)
												.join(" · ")}
										</span>
									</LinkCard>
								);
							})}
					</CardGrid>
				</section>
			))}
			<P>
				Want the boundary files directly? [Download datasets and
				boundaries](/docs/v1/downloads#boundaries).
			</P>
		</DocPage>
	);
}
