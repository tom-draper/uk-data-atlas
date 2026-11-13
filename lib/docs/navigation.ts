import {
	DATASET_TREE,
	getRegisteredDataset,
	themeOfTopic,
	type DatasetTheme,
	type DatasetTopic,
} from "@uk-data-atlas/datasets";
import { ENDPOINTS } from "./content/endpoints";
import { GEOGRAPHIES, GEOGRAPHY_GROUPS } from "./content/geographies";
import { SECTIONS } from "./content/sections";
import {
	operationHref,
	type ApiContract,
	type DocsOperation,
	type DocsSection,
	type HttpMethod,
} from "./openapi";

/**
 * The shape of the docs site: the written pages, then the reference generated
 * from the spec. The sidebar, the previous/next links and the sitemap all read
 * from here, so a page is added in one place.
 */

export interface NavLink {
	href: string;
	title: string;
	method?: HttpMethod;
	/** Extra text the sidebar filter matches, such as a route. */
	keywords?: string;
	/** Pages nested beneath this one, such as a section's endpoints. */
	children?: NavLink[];
}

export interface NavGroup {
	title: string;
	links: NavLink[];
}

export const GET_STARTED: NavLink[] = [
	{ href: "/docs/v1", title: "Introduction" },
	{ href: "/docs/v1/quickstart", title: "Quickstart" },
	{ href: "/docs/v1/early-access", title: "Early access" },
	{ href: "/docs/v1/changelog", title: "Changelog" },
];

export const CONCEPTS: NavLink[] = [
	{ href: "/docs/v1/concepts/measures", title: "Measures and periods" },
	{ href: "/docs/v1/concepts/areas", title: "Areas and boundaries" },
	{ href: "/docs/v1/concepts/places", title: "Places and named locations" },
	{ href: "/docs/v1/concepts/crosswalks", title: "Crosswalks" },
	{ href: "/docs/v1/concepts/releases", title: "Atlas releases" },
];

export const USING_THE_API: NavLink[] = [
	{ href: "/docs/v1/responses", title: "Responses" },
	{ href: "/docs/v1/pagination", title: "Pagination" },
	{ href: "/docs/v1/formats", title: "CSV and bulk downloads" },
	{ href: "/docs/v1/caching", title: "Caching" },
	{ href: "/docs/v1/rate-limits", title: "Rate limits" },
	{ href: "/docs/v1/errors", title: "Errors" },
];

export const GUIDES: NavLink[] = [
	{ href: "/docs/v1/guides/map", title: "Draw a map" },
	{ href: "/docs/v1/guides/trend", title: "Chart a trend" },
	{ href: "/docs/v1/guides/compare", title: "Compare an area" },
	{ href: "/docs/v1/guides/postcode-profile", title: "Profile a postcode" },
	{
		href: "/docs/v1/guides/constituency",
		title: "Brief on a constituency",
	},
	{
		href: "/docs/v1/guides/areas-in-need",
		title: "Find the areas most in need",
	},
	{ href: "/docs/v1/guides/coordinate", title: "Explore a coordinate" },
	{
		href: "/docs/v1/guides/batch-locations",
		title: "Locate a batch of points",
	},
	{
		href: "/docs/v1/guides/identify-codes",
		title: "Identify a column of codes",
	},
	{ href: "/docs/v1/guides/join-data", title: "Join your own data" },
	{
		href: "/docs/v1/guides/convert-counts",
		title: "Convert your own counts",
	},
	{ href: "/docs/v1/guides/named-place", title: "Explore a named place" },
	{ href: "/docs/v1/guides/sync", title: "Keep a copy in sync" },
];

export const DATASETS_HREF = "/docs/v1/datasets";

export const themeHref = (theme: DatasetTheme): string =>
	`${DATASETS_HREF}/${theme}`;

export const topicHref = (topic: DatasetTopic): string =>
	`${themeHref(themeOfTopic(topic))}/${topic}`;

/** The docs page of a dataset, at its theme, topic and id. */
export function datasetPageHref(id: string): string {
	const dataset = getRegisteredDataset(id);
	if (!dataset) throw new Error(`No dataset ${id} in the registry`);
	return `${topicHref(dataset.topic)}/${id}`;
}

export function geographyHref(geography: string): string {
	return `/docs/v1/boundaries/${GEOGRAPHIES[geography].slug}`;
}

/** The registry's themes, each with its topics; a topic page lists its datasets. */
export const DATA: NavLink[] = [
	{ href: DATASETS_HREF, title: "All datasets" },
	...DATASET_TREE.map(({ theme, topics }): NavLink => ({
		href: themeHref(theme.id),
		title: theme.label,
		children: topics.map(({ topic }) => ({
			href: topicHref(topic.id),
			title: topic.label,
		})),
	})),
	{ href: "/docs/v1/downloads", title: "Downloads" },
];

export const GEOGRAPHY_LINKS: NavLink[] = [
	{ href: "/docs/v1/boundaries", title: "All boundaries" },
	...GEOGRAPHY_GROUPS.map((group) => ({
		href: `/docs/v1/boundaries#${group.id}`,
		title: group.title,
		children: Object.entries(GEOGRAPHIES)
			.filter(([, content]) => content.group === group.id)
			.map(([id, content]) => ({
				href: geographyHref(id),
				title: content.title,
			})),
	})),
	{ href: "/docs/v1/downloads#boundaries", title: "Downloads" },
];

export const REFERENCE_HOME: NavLink = {
	href: "/docs/v1/reference",
	title: "Reference overview",
};

export function endpointContent(operation: DocsOperation) {
	const content = ENDPOINTS[operation.id];
	if (!content) {
		throw new Error(`No docs content for the ${operation.id} endpoint`);
	}
	return content;
}

export function sectionContent(section: DocsSection) {
	const content = SECTIONS[section.slug];
	if (!content) {
		throw new Error(`No docs content for the ${section.slug} section`);
	}
	return content;
}

export function sectionHref(section: DocsSection): string {
	return `/docs/v1/reference/${section.slug}`;
}

export function docsNavigation(contract: ApiContract): NavGroup[] {
	return [
		{ title: "Get started", links: GET_STARTED },
		{ title: "Concepts", links: CONCEPTS },
		{ title: "Using the API", links: USING_THE_API },
		{ title: "Guides", links: GUIDES },
		{ title: "Datasets", links: DATA },
		{ title: "Boundaries", links: GEOGRAPHY_LINKS },
		{
			title: "API reference",
			links: [
				REFERENCE_HOME,
				...contract.sections.map((section) => ({
					href: sectionHref(section),
					title: sectionContent(section).title,
					children: section.operations.map((operation) => ({
						href: operationHref(operation),
						title: endpointContent(operation).title,
						method: operation.method,
						keywords: operation.path,
					})),
				})),
			],
		},
	];
}

/** Pages in order; a heading that only points into another page is skipped. */
function flatten(links: NavLink[]): NavLink[] {
	return links.flatMap(({ children, ...link }) => [
		...(link.href.includes("#") ? [] : [link]),
		...flatten(children ?? []),
	]);
}

/** A topic's dataset pages, which the sidebar leaves out: topic pages list them. */
const DATASET_LINKS = new Map<string, NavLink[]>(
	DATASET_TREE.flatMap(({ topics }) =>
		topics.map(({ topic, datasets }): [string, NavLink[]] => [
			topicHref(topic.id),
			datasets.map((dataset) => ({
				href: datasetPageHref(dataset.id),
				title: dataset.title,
			})),
		]),
	),
);

/**
 * Every page in reading order, for previous and next links, the sitemap and
 * llms.txt. Each topic is followed by its dataset pages.
 */
export function readingOrder(contract: ApiContract): NavLink[] {
	return docsNavigation(contract)
		.flatMap((group) => flatten(group.links))
		.flatMap((link) => [link, ...(DATASET_LINKS.get(link.href) ?? [])]);
}

export function neighbours(
	contract: ApiContract,
	href: string,
): { previous?: NavLink; next?: NavLink } {
	const order = readingOrder(contract);
	const index = order.findIndex((link) => link.href === href);
	if (index === -1) return {};
	return { previous: order[index - 1], next: order[index + 1] };
}
