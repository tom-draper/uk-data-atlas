import type { Metadata } from "next";
import { Fragment } from "react";
import { H2, H3, P, Table } from "@/components/docs/Content";
import Facts from "@/components/docs/Facts";
import { TextLink } from "@/components/docs/Prose";
import ReferencePage from "@/components/reference/ReferencePage";
import {
	boundariesByGroup,
	boundaryEntries,
	datasetHref,
} from "@/lib/reference/entries";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
	subject: "UK Boundaries",
	description:
		"Every kind of UK area in the UK Data Atlas, explained: local authorities, wards, constituencies, LSOAs, MSOAs, data zones, health boards and more, with the data published on each.",
	path: "/boundaries",
});

export default function BoundariesPage() {
	const entries = boundaryEntries();
	const groups = boundariesByGroup(entries);

	return (
		<ReferencePage
			label="Boundaries"
			groups={[
				{
					title: "Overview",
					links: [
						{ id: "about-boundaries", title: "About boundaries" },
						{ id: "all-boundaries", title: "All boundaries" },
					],
				},
				...groups.map((group) => ({
					title: group.title,
					links: group.boundaries.map((boundary) => ({
						id: boundary.slug,
						title: boundary.title,
					})),
				})),
			]}
			eyebrow="Boundaries"
			title="UK boundaries in the Atlas"
			lede="The kinds of area UK statistics are published for, from the four nations down to neighbourhoods of a few hundred people. Each one below explains what the areas are, who uses them, and which datasets in the Atlas are published on them."
		>
			<H2 id="about-boundaries">About boundaries</H2>
			<P>
				Official figures are always published for a set of areas: a
				council&apos;s figures for each local authority, a census table
				for each small neighbourhood, an election result for each
				constituency. The lines around those areas are boundaries, and a
				map can only colour in the areas its data was published for.
			</P>
			<P>
				Each area has a nine-character code from the Office for National
				Statistics, such as E08000003 for Manchester, which stays the
				same as long as the area does. Boundaries are redrawn from time
				to time, when councils merge or wards are reviewed, so the Atlas
				keeps several releases of each and matches every dataset to the
				boundaries its figures were published on.
			</P>

			<H2 id="all-boundaries">All boundaries</H2>
			<Table
				head={["Boundary", "Areas", "Coverage", "Datasets"]}
				rows={groups.flatMap((group) =>
					group.boundaries.map((boundary) => [
						<TextLink key="name" href={`#${boundary.slug}`}>
							{boundary.title}
						</TextLink>,
						boundary.areas?.toLocaleString("en-GB") ?? "",
						boundary.coverage ?? "",
						boundary.datasets.length > 0
							? String(boundary.datasets.length)
							: "",
					]),
				)}
			/>

			{groups.map((group) => (
				<section key={group.id}>
					<H2 id={group.id}>{group.title}</H2>
					{group.boundaries.map((boundary) => (
						<section key={boundary.id}>
							<H3 id={boundary.slug}>{boundary.title}</H3>
							<P>{boundary.intro}</P>
							<P>{boundary.detail}</P>
							<Facts
								items={[
									...(boundary.areas !== undefined
										? [
												{
													label: "Areas",
													value: boundary.areas.toLocaleString(
														"en-GB",
													),
												},
											]
										: []),
									...(boundary.coverage
										? [
												{
													label: "Coverage",
													value: boundary.coverage,
												},
											]
										: []),
									...(boundary.latest
										? [
												{
													label: "Latest release",
													value: boundary.latest
														.temporalCoverage,
												},
												{
													label: "Published by",
													value: boundary.latest
														.source.publisher,
												},
											]
										: []),
									{
										label: "API",
										value: (
											<TextLink href={boundary.docsHref}>
												Boundary releases and files
											</TextLink>
										),
									},
								]}
							/>
							<p className="-mt-4 text-[14px] leading-[1.7] text-slate-600">
								{boundary.datasets.length > 0 ? (
									<>
										<span className="text-slate-500">
											Datasets on these areas:{" "}
										</span>
										{boundary.datasets.map((dataset, i) => (
											<Fragment key={dataset.slug}>
												{i > 0 && ", "}
												<TextLink
													href={datasetHref(
														dataset.slug,
													)}
												>
													{dataset.source.name}
												</TextLink>
											</Fragment>
										))}
									</>
								) : (
									<span className="text-slate-500">
										No datasets in the Atlas are published
										on these areas yet.
									</span>
								)}
							</p>
						</section>
					))}
				</section>
			))}
		</ReferencePage>
	);
}
