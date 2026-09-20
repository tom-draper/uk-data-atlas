import { withCDN } from "../../helpers/cdn";
import { BOUNDARY_CATALOG } from "./catalog";

const LSOA_LAD_MAPPINGS_URL = withCDN(
	"/data/precompiled/lsoa-lad-mappings.json",
);

export type LsoaLadMappings = {
	version: 1;
	lsoaToLad: Record<number, Record<string, string>>;
};

let pending: Promise<LsoaLadMappings> | null = null;

/**
 * The small-area releases do not carry a local-authority parent in their
 * properties. This build-time lookup supplies that clean nesting relation
 * without using a named location's deliberately coarse bounding box.
 */
export const fetchLsoaLadMappings = (): Promise<LsoaLadMappings> => {
	if (!pending) {
		pending = fetch(LSOA_LAD_MAPPINGS_URL)
			.then(async (response) => {
				if (!response.ok) {
					throw new Error(
						`Failed to fetch LSOA/LAD mappings: ${response.status} ${response.statusText}`,
					);
				}
				return (await response.json()) as LsoaLadMappings;
			})
			.catch((error) => {
				pending = null;
				throw error;
			});
	}
	return pending;
};

export const lsoaToLadForYear = (
	mappings: LsoaLadMappings,
	year: number,
): Record<string, string> | undefined => mappings.lsoaToLad[year];

export const lsoaYearForBoundaryAsset = (asset: string): number | undefined => {
	const year = Object.entries(BOUNDARY_CATALOG.lsoa.vintages).find(
		([, path]) => path === asset,
	)?.[0];
	return year === undefined ? undefined : Number(year);
};
