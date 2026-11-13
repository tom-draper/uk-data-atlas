import type { RegisteredDataset } from "@uk-data-atlas/datasets";
import type { Catalogue } from "@/lib/docs/catalogue";
import { CardGrid, LinkCard } from "@/components/docs/Content";
import { capitalise, dataPageFacts, yearSpan } from "@/lib/docs/dataPages";
import { datasetPageHref } from "@/lib/docs/navigation";

/** Cards for some datasets, each with the nations and years the API serves. */
export default function DatasetCards({
	datasets,
	catalogue,
	hash = "",
}: {
	datasets: readonly RegisteredDataset[];
	catalogue: Catalogue;
	/** Appended to each link, such as `#downloads`. */
	hash?: string;
}) {
	return (
		<CardGrid>
			{datasets.map((dataset) => {
				const facts = dataPageFacts([dataset.id], catalogue);
				return (
					<LinkCard
						key={dataset.id}
						href={`${datasetPageHref(dataset.id)}${hash}`}
						title={dataset.title}
					>
						{dataset.summary ?? dataset.about}
						{facts.measures.length > 0 && (
							<span className="mt-2 block text-[12.5px] text-slate-400">
								{capitalise(facts.nations)} ·{" "}
								{facts.singlePeriod ?? yearSpan(facts.years)}
							</span>
						)}
					</LinkCard>
				);
			})}
		</CardGrid>
	);
}
