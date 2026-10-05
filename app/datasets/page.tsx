import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import { H2, H3, P, Table } from "@/components/docs/Content";
import Facts from "@/components/docs/Facts";
import { TextLink } from "@/components/docs/Prose";
import ReferencePage from "@/components/reference/ReferencePage";
import {
	boundaryHref,
	datasetEntries,
	datasetsByTopic,
} from "@/lib/reference/entries";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
	subject: "UK Datasets",
	description:
		"Every official UK dataset in the UK Data Atlas, explained: what it measures, who publishes it, the years and nations covered, its licence and the boundaries it's published on.",
	path: "/datasets",
});

function ExternalLink({
	href,
	children,
}: {
	href: string;
	children: ReactNode;
}) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className="font-medium text-slate-800 underline decoration-slate-400 underline-offset-[3px] hover:decoration-slate-700"
		>
			{children}
		</a>
	);
}

/** Links run together as a sentence: "A, B and C". */
function LinkList({ links }: { links: { name: string; href: string }[] }) {
	return links.map((link, i) => (
		<Fragment key={link.href}>
			{i > 0 && (i === links.length - 1 ? " and " : ", ")}
			<TextLink href={link.href}>{link.name}</TextLink>
		</Fragment>
	));
}

export default function DatasetsPage() {
	const entries = datasetEntries();
	const topics = datasetsByTopic(entries);

	return (
		<ReferencePage
			label="Datasets"
			groups={[
				{
					title: "Overview",
					links: [{ id: "all-datasets", title: "All datasets" }],
				},
				...topics.map((topic) => ({
					title: topic.title,
					links: topic.datasets.map((dataset) => ({
						id: dataset.slug,
						title: dataset.source.name,
					})),
				})),
			]}
			eyebrow="Datasets"
			title="UK Data Atlas Datasets"
			lede={
				<>
					The official statistics behind the UK Data Atlas, from
					population and house prices to deprivation and election
					results. Each dataset below explains what it measures, who
					publishes it, the years and nations it covers, and the{" "}
					<TextLink href="/geographies">geographies</TextLink> its
					figures are published on.
				</>
			}
		>
			<H2 id="all-datasets">All datasets</H2>
			<Table
				head={["Dataset", "Published by", "Years", "Boundaries"]}
				rows={topics.flatMap((topic) =>
					topic.datasets.map((dataset) => [
						<TextLink key="name" href={`#${dataset.slug}`}>
							{dataset.source.name}
						</TextLink>,
						dataset.source.source,
						dataset.source.year,
						<TextLink
							key="boundary"
							href={boundaryHref(dataset.geography)}
						>
							{dataset.geographyTitle}
						</TextLink>,
					]),
				)}
			/>

			{topics.map((topic) => (
				<section key={topic.id}>
					<H2 id={topic.id}>{topic.title}</H2>
					{topic.datasets.map((dataset) => (
						<section key={dataset.slug}>
							<H3 id={dataset.slug}>{dataset.source.name}</H3>
							<P>{dataset.about}</P>
							<Facts
								items={[
									{
										label: "Published by",
										value: (
											<ExternalLink
												href={dataset.source.sourceUrl}
											>
												{dataset.source.source}
											</ExternalLink>
										),
									},
									{
										label: "Years",
										value: dataset.source.year,
									},
									...(dataset.coverage
										? [
												{
													label: "Coverage",
													value: dataset.coverage,
												},
											]
										: []),
									{
										label: "Boundaries",
										value: (
											<TextLink
												href={boundaryHref(
													dataset.geography,
												)}
											>
												{dataset.geographyTitle}
											</TextLink>
										),
									},
									{
										label: "Licence",
										value: (
											<ExternalLink
												href={dataset.source.licenceUrl}
											>
												{dataset.source.licence}
											</ExternalLink>
										),
									},
									...(dataset.maps.length > 0
										? [
												{
													label: "Maps",
													value: (
														<LinkList
															links={dataset.maps}
														/>
													),
												},
											]
										: []),
									...(dataset.docsHref
										? [
												{
													label: "API",
													value: (
														<TextLink
															href={
																dataset.docsHref
															}
														>
															API documentation
														</TextLink>
													),
												},
											]
										: []),
								]}
							/>
							<p className="-mt-4 text-[13.5px] leading-[1.7] text-slate-500">
								{dataset.source.description}
							</p>
						</section>
					))}
				</section>
			))}
		</ReferencePage>
	);
}
