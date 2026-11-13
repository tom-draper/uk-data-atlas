import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
	DATASET_TREE,
	getDatasetTheme,
	isDatasetTheme,
} from "@uk-data-atlas/datasets";
import { loadCatalogue } from "@/lib/docs/catalogue";
import DatasetCards from "@/components/docs/DatasetCards";
import { DocPage, H2, P } from "@/components/docs/Content";
import { TextLink } from "@/components/docs/Prose";
import { docsMetadata } from "@/lib/docs/metadata";
import { DATASETS_HREF, themeHref, topicHref } from "@/lib/docs/navigation";

type Params = Promise<{ theme: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
	return DATASET_TREE.map(({ theme }) => ({ theme: theme.id }));
}

export async function generateMetadata({
	params,
}: {
	params: Params;
}): Promise<Metadata> {
	const { theme } = await params;
	if (!isDatasetTheme(theme)) return {};
	const info = getDatasetTheme(theme);
	return docsMetadata(
		`${info.label}: datasets by area`,
		info.description,
		themeHref(theme),
	);
}

export default async function ThemePage({ params }: { params: Params }) {
	const { theme: id } = await params;
	const branch = DATASET_TREE.find(({ theme }) => theme.id === id);
	if (!branch) notFound();
	const { theme, topics } = branch;
	const catalogue = await loadCatalogue();
	return (
		<DocPage
			href={themeHref(theme.id)}
			trail={[{ label: "Datasets", href: DATASETS_HREF }]}
			eyebrow="Theme"
			title={theme.label}
			lede={theme.description}
			toc={topics.map(({ topic }) => ({
				id: topic.id,
				title: topic.label,
			}))}
		>
			{topics.map(({ topic, datasets }) => (
				<section key={topic.id}>
					<H2 id={topic.id}>{topic.label}</H2>
					<P>{topic.description}</P>
					<DatasetCards datasets={datasets} catalogue={catalogue} />
					<P>
						<TextLink href={topicHref(topic.id)}>
							All {topic.label.toLowerCase()} datasets
						</TextLink>
					</P>
				</section>
			))}
		</DocPage>
	);
}
