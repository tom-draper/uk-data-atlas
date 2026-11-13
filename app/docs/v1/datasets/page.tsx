import { DATASET_TREE } from "@uk-data-atlas/datasets";
import { loadCatalogue } from "@/lib/docs/catalogue";
import DatasetCards from "@/components/docs/DatasetCards";
import { DocPage, H2, P } from "@/components/docs/Content";
import { TextLink } from "@/components/docs/Prose";
import { docsMetadata } from "@/lib/docs/metadata";
import { DATASETS_HREF, themeHref, topicHref } from "@/lib/docs/navigation";

export const metadata = docsMetadata(
	"Datasets by area",
	"Browse the official UK statistics available through the UK Data Atlas API: population, pay, house prices, deprivation, elections, broadband, air quality, crime and more.",
	DATASETS_HREF,
);

export default async function DataPage() {
	const catalogue = await loadCatalogue();
	return (
		<DocPage
			href={DATASETS_HREF}
			eyebrow="Datasets"
			title="Datasets by area"
			lede="Every dataset in the Atlas, grouped by theme and topic. Each page explains what the data covers, which areas and years it's published for, and how to request it."
			toc={DATASET_TREE.map(({ theme }) => ({
				id: theme.id,
				title: theme.label,
			}))}
		>
			<P>
				All of it comes from official publishers such as the Office for
				National Statistics, and is served exactly as they released it.
			</P>
			{DATASET_TREE.map(({ theme, topics }) => (
				<section key={theme.id}>
					<H2 id={theme.id}>{theme.label}</H2>
					<P>{`${theme.description} [See the ${theme.label.toLowerCase()} topics](${themeHref(theme.id)}).`}</P>
					{topics.map(({ topic, datasets }) => (
						<div key={topic.id}>
							<h3 className="mt-6 text-[16px] font-semibold text-slate-900">
								<TextLink href={topicHref(topic.id)}>
									{topic.label}
								</TextLink>
							</h3>
							<DatasetCards
								datasets={datasets}
								catalogue={catalogue}
							/>
						</div>
					))}
				</section>
			))}
			<P>
				Want the files directly? [Download datasets and
				boundaries](/docs/v1/downloads#datasets).
			</P>
		</DocPage>
	);
}
