import {
	getDatasetTopic,
	type RegisteredDataset,
} from "@uk-data-atlas/datasets";
import { TextLink } from "@/components/docs/Prose";
import { datasetPageHref, topicHref } from "@/lib/docs/navigation";

/**
 * Datasets filed under another topic that list this one as related. Kept
 * apart from the topic's own datasets, as a plain list rather than cards, so
 * it reads as secondary.
 */
export default function RelatedDatasets({
	datasets,
}: {
	datasets: readonly RegisteredDataset[];
}) {
	if (datasets.length === 0) return null;
	return (
		<div
			className="my-6 border-l-2 border-slate-200 pl-4"
			data-testid="related-datasets"
		>
			<p className="text-[13px] font-medium text-slate-500">
				Related datasets from other topics
			</p>
			<ul className="mt-2 space-y-1.5 text-[14.5px] text-slate-600">
				{datasets.map((dataset) => (
					<li key={dataset.id}>
						<TextLink href={datasetPageHref(dataset.id)}>
							{dataset.title}
						</TextLink>{" "}
						<span className="text-slate-400">
							in{" "}
							<TextLink href={topicHref(dataset.topic)}>
								{getDatasetTopic(dataset.topic).label}
							</TextLink>
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}
