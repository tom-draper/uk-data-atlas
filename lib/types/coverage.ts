/** Countries a dataset can meaningfully contain, using ISO 3166-2 codes. */
export type DatasetCountry = "GB-ENG" | "GB-SCT" | "GB-WLS" | "GB-NIR";

/**
 * Geographic scope carried with compiled datasets.
 *
 * This is intentionally distinct from the codes present in a particular
 * election year: an area inside the source's scope can legitimately have no
 * result, and should remain as an uncoloured boundary on the map.
 */
export interface DatasetCoverage {
	coverageCountries?: readonly DatasetCountry[];
}
