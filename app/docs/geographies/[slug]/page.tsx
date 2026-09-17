import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocPage, EndpointRef, H2, P, Table } from "@/components/docs/Content";
import { Request } from "@/components/docs/Example";
import Facts from "@/components/docs/Facts";
import { Code, TextLink } from "@/components/docs/Prose";
import {
	loadCatalogue,
	nationList,
	periodRange,
	releasesForGeography,
} from "@/lib/docs/catalogue";
import { GEOGRAPHIES, GEOGRAPHY_GROUPS } from "@/lib/docs/content/geographies";
import {
	capitalise,
	dataPagesOnGeography,
	findGeographyBySlug,
} from "@/lib/docs/dataPages";
import { docsMetadata } from "@/lib/docs/metadata";
import { dataPageHref, geographyHref } from "@/lib/docs/navigation";
import { API_BASE_URL } from "@/lib/docs/openapi";

type Params = Promise<{ slug: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
	return Object.values(GEOGRAPHIES).map((content) => ({
		slug: content.slug,
	}));
}

export async function generateMetadata({
	params,
}: {
	params: Params;
}): Promise<Metadata> {
	const id = findGeographyBySlug((await params).slug);
	if (!id) return {};
	const content = GEOGRAPHIES[id];
	return docsMetadata(
		`${content.title} boundaries and data`,
		content.intro,
		geographyHref(id),
	);
}

export default async function GeographyPage({ params }: { params: Params }) {
	const id = findGeographyBySlug((await params).slug);
	if (!id) notFound();
	const content = GEOGRAPHIES[id];
	const catalogue = loadCatalogue();
	const releases = releasesForGeography(catalogue, id);
	const latest = releases[0];
	const latestCount = catalogue.areaCounts.get(`${id}/${latest.id}`);
	const data = dataPagesOnGeography(id, catalogue);
	const tiled = releases.find((r) =>
		catalogue.mapResources.has(`${id}/${r.id}`),
	);
	const group = GEOGRAPHY_GROUPS.find((g) => g.id === content.group);
	const name = content.title.toLowerCase();

	return (
		<DocPage
			href={geographyHref(id)}
			trail={[
				{ label: "Geographies", href: "/docs/geographies" },
				{
					label: group?.title ?? "",
					href: `/docs/geographies#${content.group}`,
				},
			]}
			title={content.title}
			lede={content.intro}
			toc={[
				{ id: "releases", title: "Boundary releases" },
				{ id: "data", title: "Data on these areas" },
				{ id: "request", title: "Request it" },
			]}
		>
			<Facts
				items={[
					{ label: "Name in the API", value: <Code>{id}</Code> },
					{
						label: "Covers",
						value: capitalise(
							nationList(latest.coverage.countries),
						),
					},
					{
						label: "Areas in the latest release",
						value:
							latestCount !== undefined
								? latestCount.toLocaleString("en-GB")
								: "Not compiled yet",
					},
					{
						label: "Published by",
						value: latest.source.publisher,
					},
				]}
			/>

			<H2 id="releases">Boundary releases</H2>
			<P>
				{releases.length === 1
					? "The Atlas holds one release of these boundaries."
					: `The Atlas holds ${releases.length} releases of these boundaries, newest first. Use the release id wherever an endpoint asks for \`release\`.`}
			</P>
			<Table
				head={["Release", "Description", "Areas", "Map tiles"]}
				rows={releases.map((release) => {
					const count = catalogue.areaCounts.get(
						`${id}/${release.id}`,
					);
					return [
						`\`${release.id}\``,
						release.title,
						count !== undefined
							? count.toLocaleString("en-GB")
							: "–",
						catalogue.mapResources.has(`${id}/${release.id}`)
							? "Yes"
							: "–",
					];
				})}
			/>
			{latest.source.licence && (
				<P>
					{`Boundaries are published by ${latest.source.publisher} under the ${latest.source.licence.name}. [Get attribution text](/docs/reference/governance/attribution) gives the credit line for a map.`}
				</P>
			)}

			<H2 id="data">Data on these areas</H2>
			{data.length > 0 ? (
				<Table
					head={["Data", "Code year", "Periods", "Covers"]}
					rows={data.flatMap(({ page, sources }) =>
						sources.map((source, i) => [
							i === 0 ? (
								<TextLink
									key="page"
									href={dataPageHref(page.slug)}
								>
									{page.title}
								</TextLink>
							) : (
								""
							),
							`\`${source.boundaryYear}\``,
							periodRange(source.periods),
							capitalise(nationList(source.countries)),
						]),
					)}
				/>
			) : (
				<P>
					{`No data in the Atlas is published on ${name} yet. You can still look up these areas, draw their boundaries, and find which other areas they sit inside or overlap.`}
				</P>
			)}

			<H2 id="request">Request it</H2>
			<P>List the areas in the latest release:</P>
			<Request
				url={`${API_BASE_URL}/areas?geography=${id}&release=${latest.id}&limit=5`}
			/>
			{tiled && (
				<>
					<P>Draw them on a map with vector tiles:</P>
					<Request
						url={`${API_BASE_URL}/map-resources/${id}/${tiled.id}/tiles.json`}
					/>
				</>
			)}
			<EndpointRef id="getAreaGeometry" />
			<EndpointRef id="findContainingAreas" />
			{releases.length > 1 && (
				<EndpointRef id="resolveBoundaryReleaseForDate" />
			)}
		</DocPage>
	);
}
