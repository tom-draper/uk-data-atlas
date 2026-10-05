import type { Metadata } from "next";
import { Fragment } from "react";
import { EndpointRef, H2, H3, P, Table } from "@/components/docs/Content";
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
	subject: "Geographies & Boundaries",
	description:
		"Every kind of UK area in the UK Data Atlas, explained: local authorities, wards, constituencies, LSOAs, MSOAs, data zones, health boards and more, with the data published on each.",
	path: "/geographies",
});

export default function GeographiesPage() {
	const entries = boundaryEntries();
	const groups = boundariesByGroup(entries);

	return (
		<ReferencePage
			label="Geographies"
			groups={[
				{
					title: "Overview",
					links: [
						{ id: "about-geographies", title: "About geographies" },
						{ id: "all-geographies", title: "All geographies" },
					],
				},
				...groups.map((group) => ({
					title: group.title,
					links: group.boundaries.map((boundary) => ({
						id: boundary.slug,
						title: boundary.title,
					})),
				})),
				{
					title: "Postcodes and places",
					links: [
						{ id: "postcodes", title: "Postcodes" },
						{
							id: "named-places",
							title: "Counties and named places",
						},
					],
				},
			]}
			eyebrow="Geographies"
			title="Geographies & boundaries"
			lede="The kinds of area UK statistics are published for, from the four nations down to neighbourhoods of a few hundred people. Each one below explains what the areas are, who uses them, and which datasets in the Atlas are published on them."
		>
			<H2 id="about-geographies">About geographies</H2>
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
			<P>
				Because boundaries move, an area&apos;s figures from different
				releases aren&apos;t always about the same place. To compare
				them, or to add small areas up into larger ones, the Atlas
				connects each set of areas to the others: which areas sit inside
				which, which replaced which, and how much those that don&apos;t
				nest overlap. The API calls these{" "}
				<TextLink href="/docs/v1/concepts/crosswalks">
					crosswalks
				</TextLink>
				.
			</P>

			<H2 id="all-geographies">All geographies</H2>
			<Table
				head={["Geography", "Areas", "Coverage", "Datasets"]}
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

			<section>
				<H2 id="postcodes-and-places">Postcodes and places</H2>
				<P>
					Not every way of describing where something is comes with
					official boundaries. Postcodes and counties are how most
					people say where they live, so the Atlas works out which of
					the areas above they fall in.
				</P>

				<H3 id="postcodes">Postcodes</H3>
				<P>
					Royal Mail draws up postcodes to deliver post, not to
					publish statistics. A full postcode, such as M1 1AE, covers
					around 15 addresses on average. Its first half is the
					postcode district (M1), which belongs to a postcode area
					(M).
				</P>
				<P>
					Postcodes don&apos;t have official boundaries. The Office
					for National Statistics publishes a single point for each
					one, roughly at the middle of its addresses, and the Atlas
					finds the areas that point falls in. A postcode near the
					edge of a ward or LSOA can have addresses on both sides, so
					the answer is the area its point falls in, and the API flags
					postcodes close to a boundary. Northern Ireland postcodes
					aren&apos;t available, because of licensing restrictions.
				</P>
				<EndpointRef id="resolvePostcode" />

				<H3 id="named-places">Counties and named places</H3>
				<P>
					When people say &quot;Kent&quot; or &quot;Lancashire&quot;,
					they usually mean a ceremonial county, the county a
					lord-lieutenant is appointed to, rather than the county
					council. Ceremonial counties take in the unitary authorities
					inside them, such as Medway in Kent or Blackpool in
					Lancashire, and have no official statistics code of their
					own. The Atlas also holds the historic counties of around
					1888, and groupings like North Wales that have no official
					status at all.
				</P>
				<P>
					Official statistics are published for councils rather than
					these counties, so the Atlas builds each one from the local
					authorities inside it. A council is counted in the county
					holding most of its area, so the edges follow council lines
					rather than the county&apos;s own. Scotland&apos;s
					lieutenancy areas don&apos;t follow council lines, so they
					aren&apos;t included.
				</P>
				<EndpointRef id="listNamedLocations" />
			</section>
		</ReferencePage>
	);
}
