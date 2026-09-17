import { ENDPOINTS } from "./content/endpoints";
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
	{ href: "/docs/errors", title: "Errors" },
];

export const GUIDES: NavLink[] = [
	{ href: "/docs/guides/map", title: "Draw a map" },
	{ href: "/docs/guides/trend", title: "Chart a trend" },
	{ href: "/docs/guides/sync", title: "Keep a copy in sync" },
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

function flatten(links: NavLink[]): NavLink[] {
	return links.flatMap(({ children, ...link }) => [
		link,
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
