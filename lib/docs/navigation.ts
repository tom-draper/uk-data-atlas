import { DATA_PAGES, DATA_TOPICS } from "./content/data";
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
	{ href: "/docs", title: "Introduction" },
	{ href: "/docs/quickstart", title: "Quickstart" },
];

export const CONCEPTS: NavLink[] = [
	{ href: "/docs/concepts/measures", title: "Measures and periods" },
	{ href: "/docs/concepts/areas", title: "Areas and boundaries" },
	{ href: "/docs/concepts/places", title: "Places and named locations" },
	{ href: "/docs/concepts/crosswalks", title: "Crosswalks" },
	{ href: "/docs/concepts/releases", title: "Atlas releases" },
];

export const USING_THE_API: NavLink[] = [
	{ href: "/docs/responses", title: "Responses" },
	{ href: "/docs/pagination", title: "Pagination" },
	{ href: "/docs/formats", title: "CSV and bulk downloads" },
	{ href: "/docs/caching", title: "Caching" },
	{ href: "/docs/rate-limits", title: "Rate limits" },
	{ href: "/docs/errors", title: "Errors" },
];

export const GUIDES: NavLink[] = [
	{ href: "/docs/guides/map", title: "Draw a map" },
	{ href: "/docs/guides/trend", title: "Chart a trend" },
	{ href: "/docs/guides/sync", title: "Keep a copy in sync" },
];

export function dataPageHref(slug: string): string {
	return `/docs/data/${slug}`;
}

export function geographyHref(geography: string): string {
	return `/docs/geographies/${GEOGRAPHIES[geography].slug}`;
}

/** Data pages under their topics, each topic an anchor on the data overview. */
export const DATA: NavLink[] = [
	{ href: "/docs/data", title: "All data" },
	...DATA_TOPICS.map((topic): NavLink => {
		const pages = DATA_PAGES.filter((page) => page.topic === topic.id);
		// A topic of one page is just that page.
		if (pages.length === 1) {
			return { href: dataPageHref(pages[0].slug), title: topic.title };
		}
		return {
			href: `/docs/data#${topic.id}`,
			title: topic.title,
			children: pages.map((page) => ({
				href: dataPageHref(page.slug),
				title: page.title,
			})),
		};
	}),
];

export const GEOGRAPHY_LINKS: NavLink[] = [
	{ href: "/docs/geographies", title: "All geographies" },
	...GEOGRAPHY_GROUPS.map((group) => ({
		href: `/docs/geographies#${group.id}`,
		title: group.title,
		children: Object.entries(GEOGRAPHIES)
			.filter(([, content]) => content.group === group.id)
			.map(([id, content]) => ({
				href: geographyHref(id),
				title: content.title,
			})),
	})),
];

export const REFERENCE_HOME: NavLink = {
	href: "/docs/reference",
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
	return `/docs/reference/${section.slug}`;
}

export function docsNavigation(contract: ApiContract): NavGroup[] {
	return [
		{ title: "Get started", links: GET_STARTED },
		{ title: "Concepts", links: CONCEPTS },
		{ title: "Using the API", links: USING_THE_API },
		{ title: "Guides", links: GUIDES },
		{ title: "Data", links: DATA },
		{ title: "Geographies", links: GEOGRAPHY_LINKS },
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

/** Every page in reading order, for previous and next links. */
export function readingOrder(contract: ApiContract): NavLink[] {
	return docsNavigation(contract).flatMap((group) => flatten(group.links));
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
