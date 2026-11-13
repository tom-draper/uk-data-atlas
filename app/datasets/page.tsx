import { loadCatalogue } from "@/lib/docs/catalogue";
import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import { H2, H3, P, Table } from "@/components/docs/Content";
import Facts from "@/components/docs/Facts";
import { TextLink } from "@/components/docs/Prose";
import ReferencePage from "@/components/reference/ReferencePage";
import {
	boundaryHref,
	datasetEntries,
	datasetsByTheme,
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

export default async function DatasetsPage() {
	const catalogue = await loadCatalogue();
	const entries = datasetEntries(catalogue);
	const themes = datasetsByTheme(entries);

	return (
		<ReferencePage
			label="Datasets"
			groups={[
				{
					title: "Overview",
					links: [
						{ id: "about-datasets", title: "About datasets" },
						{ id: "all-datasets", title: "All datasets" },
					],
				},
				...themes.map(({ theme, topics }) => ({
					title: theme.label,
					links: topics.flatMap(({ datasets }) =>
						datasets.map((dataset) => ({
							id: dataset.slug,
							title: dataset.title,
						})),
					),
				})),
			]}
			eyebrow="Datasets"
			title="Public datasets"
			lede={
				<>
					<p>
						The statistics we hold, and which areas and years they
						cover.
					</p>
					<p className="mt-2 text-[14px] text-slate-500">
						Looking for the shapes of areas? See{" "}
						<TextLink href="/boundaries">Boundaries</TextLink>.
					</p>
					<p className="mt-4">
						The official statistics behind the UK Data Atlas, from
						population and house prices to deprivation and election
						results. Each dataset below explains what it measures,
						who publishes it, the years and nations it covers, and
						the <TextLink href="/boundaries">boundaries</TextLink>{" "}
						its figures are published on.
					</p>
				</>
			}
		>
			<H2 id="about-datasets">About datasets</H2>
			<P>
				Every dataset in the Atlas is official statistics, published by
				a government department, a statistics office or a public body,
				and almost all of it is free to reuse under the Open Government
				Licence. The Atlas links each one back to its publisher, so you
				can always check a figure against the original.
			</P>
			<P>
				Health, education, housing and policing are run separately in
				England, Wales, Scotland and Northern Ireland, and each nation
				often publishes its own figures. Where a dataset covers only
				some nations, its coverage below says so, and where the nations
				count something in different ways, their figures shouldn&apos;t
				be compared directly.
			</P>
			<P>
				Each dataset is matched to the{" "}
				<TextLink href="/boundaries">boundary</TextLink> release its
				figures were published on, so an area&apos;s value is always
				drawn on the lines it was counted for.
			</P>

			<H2 id="all-datasets">All datasets</H2>
			<Table
				head={["Dataset", "Published by", "Years", "Boundary"]}
				rows={themes.flatMap(({ topics }) =>
					topics.flatMap(({ datasets }) =>
						datasets.map((dataset) => [
							<TextLink key="name" href={`#${dataset.slug}`}>
								{dataset.title}
							</TextLink>,
							dataset.publisher ?? "",
							dataset.years ?? "",
							dataset.geography ? (
								<TextLink
									key="boundary"
									href={boundaryHref(dataset.geography)}
								>
									{dataset.geographyTitle}
								</TextLink>
							) : (
								""
							),
						]),
					),
				)}
			/>

			{themes.map(({ theme, topics }) => (
				<section key={theme.id}>
					<H2 id={`theme-${theme.id}`}>{theme.label}</H2>
					<P>{theme.description}</P>
					{topics.map(({ topic, datasets }) => (
						<section key={topic.id}>
							<H3 id={`topic-${topic.id}`}>{topic.label}</H3>
							{datasets.map((dataset) => (
								<section key={dataset.slug}>
									<h4
										id={dataset.slug}
										className="mt-8 scroll-mt-24 text-[16px] font-semibold text-slate-900"
									>
										{dataset.title}
									</h4>
									<P>{dataset.about}</P>
									<Facts
										items={[
											...(dataset.publisher
												? [
														{
															label: "Published by",
															value: dataset.sourceUrl ? (
																<ExternalLink
																	href={
																		dataset.sourceUrl
																	}
																>
																	{
																		dataset.publisher
																	}
																</ExternalLink>
															) : (
																dataset.publisher
															),
														},
													]
												: []),
											...(dataset.years
												? [
														{
															label: "Years",
															value: dataset.years,
														},
													]
												: []),
											...(dataset.coverage
												? [
														{
															label: "Coverage",
															value: dataset.coverage,
														},
													]
												: []),
											...(dataset.geography
												? [
														{
															label: "Boundary",
															value: (
																<TextLink
																	href={boundaryHref(
																		dataset.geography,
																	)}
																>
																	{
																		dataset.geographyTitle
																	}
																</TextLink>
															),
														},
													]
												: []),
											...(dataset.licence
												? [
														{
															label: "Licence",
															value: dataset.licenceUrl ? (
																<ExternalLink
																	href={
																		dataset.licenceUrl
																	}
																>
																	{
																		dataset.licence
																	}
																</ExternalLink>
															) : (
																dataset.licence
															),
														},
													]
												: []),
											...(dataset.maps.length > 0
												? [
														{
															label: "Maps",
															value: (
																<LinkList
																	links={
																		dataset.maps
																	}
																/>
															),
														},
													]
												: []),
											{
												label: "API",
												value: (
													<TextLink
														href={dataset.docsHref}
													>
														API documentation
													</TextLink>
												),
											},
										]}
									/>
									{dataset.description && (
										<p className="-mt-4 text-[13.5px] leading-[1.7] text-slate-500">
											{dataset.description}
										</p>
									)}
								</section>
							))}
						</section>
					))}
				</section>
			))}
		</ReferencePage>
	);
}
