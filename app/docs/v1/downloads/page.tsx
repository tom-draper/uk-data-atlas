import {
	Callout,
	CardGrid,
	DocPage,
	H2,
	LinkCard,
	P,
} from "@/components/docs/Content";
import { DATA_PAGES, DATA_TOPICS } from "@/lib/docs/content/data";
import { GEOGRAPHIES, GEOGRAPHY_GROUPS } from "@/lib/docs/content/geographies";
import { dataPageHref, geographyHref } from "@/lib/docs/navigation";
import { docsMetadata } from "@/lib/docs/metadata";

export const metadata = docsMetadata(
	"Download UK Data Atlas datasets and boundaries",
	"Download complete UK Data Atlas datasets, area-code tables and boundary files, with links to the detail page for every dataset and geography.",
	"/docs/v1/downloads",
);

export default function DownloadsPage() {
	return (
		<DocPage
			href="/docs/v1/downloads"
			eyebrow="Using the API"
			title="Download the Atlas"
			lede="Download complete datasets and boundary files, or open a detail page to see the formats, releases and checksums available for each one."
			toc={[
				{ id: "datasets", title: "Datasets" },
				{ id: "boundaries", title: "Boundaries" },
			]}
		>
			<Callout tone="note" title="Licences and attribution">
				Licences vary by source. Each detail page identifies the
				publisher and licence for its downloads. Keep that attribution
				when you redistribute a file, and say when you have cleaned or
				reformatted it.
			</Callout>

			<H2 id="datasets">Datasets</H2>
			<P>
				Choose a subject to see every complete observation export
				available for it. The detail page lists each measure, period and
				geography, with a direct download link.
			</P>
			{DATA_TOPICS.map((topic) => (
				<section key={topic.id}>
					<H2 id={`datasets-${topic.id}`}>{topic.title}</H2>
					<CardGrid>
						{DATA_PAGES.filter(
							(page) => page.topic === topic.id,
						).map((page) => (
							<LinkCard
								key={page.slug}
								href={`${dataPageHref(page.slug)}#downloads`}
								title={page.title}
							>
								{page.intro}
							</LinkCard>
						))}
					</CardGrid>
				</section>
			))}

			<H2 id="boundaries">Boundaries</H2>
			<P>
				Download area-code tables and any
				published GeoParquet or PMTiles boundary files, release by
				release.
			</P>
			{GEOGRAPHY_GROUPS.map((group) => (
				<section key={group.id}>
					<H2 id={`boundaries-${group.id}`}>{group.title}</H2>
					<CardGrid>
						{Object.entries(GEOGRAPHIES)
							.filter(([, content]) => content.group === group.id)
							.map(([id, content]) => (
								<LinkCard
									key={id}
									href={`${geographyHref(id)}#downloads`}
									title={content.title}
								>
									{content.intro}
								</LinkCard>
							))}
					</CardGrid>
				</section>
			))}
		</DocPage>
	);
}
