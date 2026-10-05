import {
	type AtlasLocation,
	type AtlasMap,
	atlasPageHeading,
} from "@/lib/atlas/pages";
import { atlasMapSnippet } from "@/lib/atlas/snippets";
import type { DatasetCountry } from "@/lib/types/coverage";
import { SITE_NAME, SITE_URL } from "@/lib/site";

/** Schema.org data for search engines, rendered as JSON-LD. */
export function JsonLd({ data }: { data: object }) {
	return (
		<script
			type="application/ld+json"
			// Escaped so a "</script>" inside a string cannot end the tag.
			dangerouslySetInnerHTML={{
				__html: JSON.stringify(data).replace(/</g, "\\u003c"),
			}}
		/>
	);
}

const COUNTRY_NAMES: Readonly<Record<DatasetCountry, string>> = {
	"GB-ENG": "England",
	"GB-WLS": "Wales",
	"GB-SCT": "Scotland",
	"GB-NIR": "Northern Ireland",
};

const WEBSITE = {
	"@type": "WebSite",
	"@id": `${SITE_URL}/#website`,
	name: SITE_NAME,
	url: SITE_URL,
};

/** Each dataset's row on the datasets page identifies it across map pages. */
function datasetId(map: AtlasMap) {
	return `${SITE_URL}/datasets#${map.dataset}`;
}

function breadcrumbList(trail: { name: string; path: string }[]) {
	return {
		"@type": "BreadcrumbList",
		itemListElement: trail.map((crumb, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: crumb.name,
			item: `${SITE_URL}${crumb.path}`,
		})),
	};
}

// Google skips a dataset described in fewer than 50 characters.
function datasetDescription(map: AtlasMap) {
	const { description, source } = map.source;
	return description.length >= 50
		? description
		: `${description} Published by ${source}.`;
}

function dataset(map: AtlasMap) {
	const first = Math.min(...map.periods);
	const last = Math.max(...map.periods);
	return {
		"@type": "Dataset",
		"@id": datasetId(map),
		name: map.source.name,
		description: datasetDescription(map),
		url: datasetId(map),
		sameAs: map.source.sourceUrl,
		creator: {
			"@type": "Organization",
			name: map.source.source,
			url: map.source.sourceUrl,
		},
		license: map.source.licenceUrl,
		isAccessibleForFree: true,
		temporalCoverage: first === last ? `${first}` : `${first}/${last}`,
		spatialCoverage: map.countries.map((country) => ({
			"@type": "Place",
			name: COUNTRY_NAMES[country],
		})),
	};
}

/** A map page: the page, its place in the browse pages and its dataset. */
export function atlasMapJsonLd(location: AtlasLocation, map: AtlasMap) {
	const path = `/atlas/${location.slug}/${map.slug}`;
	return {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "WebPage",
				"@id": `${SITE_URL}${path}`,
				url: `${SITE_URL}${path}`,
				name: atlasPageHeading(location, map),
				description: atlasMapSnippet(location, map),
				isPartOf: { "@id": WEBSITE["@id"] },
				about: { "@id": datasetId(map) },
				spatialCoverage: { "@type": "Place", name: location.name },
				breadcrumb: breadcrumbList([
					{ name: "Maps", path: "/maps" },
					{ name: location.name, path: `/maps/${location.slug}` },
					{ name: atlasPageHeading(location, map), path },
				]),
			},
			WEBSITE,
			dataset(map),
		],
	};
}

/** A browse page listing every map of one place. */
export function locationMapsJsonLd(
	location: AtlasLocation,
	maps: readonly AtlasMap[],
	name: string,
) {
	const path = `/maps/${location.slug}`;
	return {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "CollectionPage",
				"@id": `${SITE_URL}${path}`,
				url: `${SITE_URL}${path}`,
				name,
				isPartOf: { "@id": WEBSITE["@id"] },
				spatialCoverage: { "@type": "Place", name: location.name },
				breadcrumb: breadcrumbList([
					{ name: "Maps", path: "/maps" },
					{ name: location.name, path },
				]),
				mainEntity: {
					"@type": "ItemList",
					itemListElement: maps.map((map, index) => ({
						"@type": "ListItem",
						position: index + 1,
						name: atlasPageHeading(location, map),
						url: `${SITE_URL}/atlas/${location.slug}/${map.slug}`,
					})),
				},
			},
			WEBSITE,
		],
	};
}

/** A ranking page: its breadcrumb trail and the map's dataset. */
export function rankingJsonLd(
	location: AtlasLocation,
	map: AtlasMap,
	name: string,
	areas: number,
) {
	const path = `/maps/${location.slug}/${map.slug}`;
	return {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "WebPage",
				"@id": `${SITE_URL}${path}`,
				url: `${SITE_URL}${path}`,
				name,
				description: `${areas} areas ranked.`,
				isPartOf: { "@id": WEBSITE["@id"] },
				about: { "@id": datasetId(map) },
				spatialCoverage: { "@type": "Place", name: location.name },
				breadcrumb: breadcrumbList([
					{ name: "Maps", path: "/maps" },
					{ name: location.name, path: `/maps/${location.slug}` },
					{ name, path },
				]),
			},
			WEBSITE,
			dataset(map),
		],
	};
}

/** The site itself, so search results can show its name. */
export function websiteJsonLd() {
	return {
		"@context": "https://schema.org",
		...WEBSITE,
		description: "Interactive maps and an API for official UK statistics.",
		inLanguage: "en-GB",
		publisher: { "@type": "Person", name: "Tom Draper" },
	};
}

/**
 * A place page: its breadcrumb trail from the UK down, and the place itself
 * as an administrative area with its code and bounding box.
 */
export function placeJsonLd({
	path,
	title,
	trail,
	place,
}: {
	path: string;
	title: string;
	/** Every crumb but the last links to its page. */
	trail: { label: string; href?: string }[];
	place: {
		name: string;
		/** The area's GSS code, for an area. */
		code?: string;
		/** West, south, east, north. */
		bbox?: [number, number, number, number];
	};
}) {
	const [west, south, east, north] = place.bbox ?? [];
	return {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "WebPage",
				"@id": `${SITE_URL}${path}`,
				url: `${SITE_URL}${path}`,
				name: title,
				isPartOf: { "@id": WEBSITE["@id"] },
				breadcrumb: breadcrumbList(
					trail.map((crumb) => ({
						name: crumb.label,
						path: crumb.href ?? path,
					})),
				),
				about: {
					"@type": "AdministrativeArea",
					name: place.name,
					...(place.code ? { identifier: place.code } : {}),
					...(west !== undefined && north !== undefined
						? {
								geo: {
									"@type": "GeoShape",
									box: `${south} ${west} ${north} ${east}`,
								},
							}
						: {}),
				},
			},
			WEBSITE,
		],
	};
}
