import { withCDN } from "../../helpers/cdn";
import { BOUNDARY_CATALOG } from "./catalog";

export type LsoaLadMapping = {
	version: 1;
	year: number;
	lsoaToLad: Record<string, string>;
};

const pending = new Map<number, Promise<Record<string, string>>>();

const lsoaLadMappingUrl = (year: number) =>
	withCDN(`/data/precompiled/lsoa-lad-mappings-${year}.json`);

/**
 * The small-area releases do not carry a local-authority parent in their
 * properties. This build-time lookup supplies that clean nesting relation
 * without using a named location's deliberately coarse bounding box.
 */
export const fetchLsoaToLad = (
	year: number,
): Promise<Record<string, string>> => {
	const cached = pending.get(year);
	if (cached) return cached;

	const request = fetch(lsoaLadMappingUrl(year))
		.then(async (response) => {
			if (!response.ok) {
				throw new Error(
					`Failed to fetch LSOA/LAD mappings: ${response.status} ${response.statusText}`,
				);
			}
			const mapping = (await response.json()) as LsoaLadMapping;
			if (mapping.year !== year || !mapping.lsoaToLad) {
				throw new Error(`Invalid LSOA/LAD mapping for ${year}`);
			}
			return mapping.lsoaToLad;
		})
		.catch((error) => {
			pending.delete(year);
			throw error;
		});
	pending.set(year, request);
	return request;
};

export const lsoaYearForBoundaryAsset = (asset: string): number | undefined => {
	const year = Object.entries(BOUNDARY_CATALOG.lsoa.vintages).find(
		([, path]) => path === asset,
	)?.[0];
	return year === undefined ? undefined : Number(year);
};
