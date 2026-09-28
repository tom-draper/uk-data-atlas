import { CardGrid, DocPage, H2, LinkCard, P } from "@/components/docs/Content";
import { DATA_PAGES, DATA_TOPICS } from "@/lib/docs/content/data";
import { capitalise, dataPageFacts, yearSpan } from "@/lib/docs/dataPages";
import { docsMetadata } from "@/lib/docs/metadata";
import { dataPageHref } from "@/lib/docs/navigation";

export const metadata = docsMetadata(
	"UK data by area",
	"Browse the official UK statistics available through the UK Data Atlas API: population, pay, house prices, deprivation, elections, broadband, air quality, crime and more.",
	"/docs/v1/data",
);

export default function DataPage() {
	return (
		<DocPage
			href="/docs/v1/data"
			eyebrow="Data"
			title="UK data by area"
			lede="Every dataset you can get through the API, grouped by subject. Each page explains what the data covers, which areas and years it's published for, and how to request it."
			toc={DATA_TOPICS.map((topic) => ({
				id: topic.id,
				title: topic.title,
			}))}
		>
			<P>
				All of it comes from official publishers such as the Office for
				National Statistics, and is served exactly as they released it.
			</P>
			{DATA_TOPICS.map((topic) => (
				<section key={topic.id}>
					<H2 id={topic.id}>{topic.title}</H2>
					<CardGrid>
						{DATA_PAGES.filter(
							(page) => page.topic === topic.id,
						).map((page) => {
							const facts = dataPageFacts(page);
							return (
								<LinkCard
									key={page.slug}
									href={dataPageHref(page.slug)}
									title={page.title}
								>
									{page.intro}
									<span className="mt-2 block text-[12.5px] text-slate-400">
										{capitalise(facts.nations)} ·{" "}
										{facts.singlePeriod ??
											yearSpan(facts.years)}
									</span>
								</LinkCard>
							);
						})}
					</CardGrid>
				</section>
			))}
			<P>
				Want the files directly? [Download datasets and
				boundaries](/docs/v1/downloads#datasets).
			</P>
		</DocPage>
	);
}
