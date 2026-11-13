import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DATASET_TREE } from "@uk-data-atlas/datasets";
import { loadCatalogue } from "@/lib/docs/catalogue";
import DatasetCards from "@/components/docs/DatasetCards";
import RelatedDatasets from "@/components/docs/RelatedDatasets";
import { DocPage } from "@/components/docs/Content";
import { docsMetadata } from "@/lib/docs/metadata";
import { DATASETS_HREF, themeHref, topicHref } from "@/lib/docs/navigation";

type Params = Promise<{ theme: string; topic: string }>;

/** The topic at an address, only when it sits under that theme. */
function findTopic({ theme, topic }: Awaited<Params>) {
	return DATASET_TREE.find(({ theme: t }) => t.id === theme)?.topics.find(
		(branch) => branch.topic.id === topic,
	);
}

export const dynamicParams = false;

export function generateStaticParams() {
	return DATASET_TREE.flatMap(({ theme, topics }) =>
		topics.map(({ topic }) => ({ theme: theme.id, topic: topic.id })),
	);
}

export async function generateMetadata({
	params,
}: {
	params: Params;
}): Promise<Metadata> {
	const branch = findTopic(await params);
	if (!branch) return {};
	return docsMetadata(
		`${branch.topic.label}: datasets by area`,
		branch.topic.description,
		topicHref(branch.topic.id),
	);
}

export default async function TopicPage({ params }: { params: Params }) {
	const found = await params;
	const branch = findTopic(found);
	if (!branch) notFound();
	const { topic, datasets, related } = branch;
	const theme = DATASET_TREE.find(
		({ theme: t }) => t.id === found.theme,
	)!.theme;
	const catalogue = await loadCatalogue();
	return (
		<DocPage
			href={topicHref(topic.id)}
			trail={[
				{ label: "Datasets", href: DATASETS_HREF },
				{ label: theme.label, href: themeHref(theme.id) },
			]}
			eyebrow="Topic"
			title={topic.label}
			lede={topic.description}
		>
			<DatasetCards datasets={datasets} catalogue={catalogue} />
			<RelatedDatasets datasets={related} />
		</DocPage>
	);
}
