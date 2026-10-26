export {
	type BoundaryExtent,
	propertiesAsset,
	type BoundaryType,
	type BoundaryYear,
	BOUNDARY_TYPES,
	API_ONLY_GEOGRAPHIES,
	boundaryYears,
	boundaryTypeForCodeKey,
	nameKeyForCodeKey,
	boundaryYearForCodeKey,
} from "@uk-data-atlas/datasets/data/boundaries/catalog";
import {
	BOUNDARY_CATALOG as catalogue,
	BOUNDARY_TYPES,
} from "@uk-data-atlas/datasets/data/boundaries/catalog";
import { withCDN } from "@/lib/helpers/cdn";
const mapAsset = (asset: string) =>
	withCDN(asset.replace(/\.topojson$/, ".pmtiles"));
// Catalogue paths identify releases. The manifest selects immutable archive bytes.
export const boundaryArchiveAsset = (href: string) => {
	if (!/\/[a-f0-9]{64}\.pmtiles$/.test(href)) return withCDN(href);
	const base =
		process.env.NODE_ENV === "production"
			? (process.env.NEXT_PUBLIC_DATA_BASE_URL ?? "")
			: "";
	return `${base}${href}`;
};
export const BOUNDARY_CATALOG = { ...catalogue };
for (const type of BOUNDARY_TYPES) {
	const family = catalogue[type];
	BOUNDARY_CATALOG[type] = {
		...family,
		releases: family.releases.map((release) => ({
			...release,
			...(release.asset && { asset: mapAsset(release.asset) }),
		})),
		vintages: Object.fromEntries(
			Object.entries(family.vintages).map(([year, asset]) => [
				year,
				mapAsset(asset),
			]),
		),
		propertyVintages: Object.fromEntries(
			Object.entries(family.propertyVintages).map(([year, asset]) => [
				year,
				withCDN(asset),
			]),
		),
	};
}
