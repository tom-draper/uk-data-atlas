import { readFileSync } from "node:fs";
import type {
	SourceGeography,
	PopulationObservation,
	MeasureObservationArtifact,
} from "../dataCatalog";
import { type PrecompiledFile, object } from "./values";
import { isPublishedAreaCode } from "./countries";

/**
 * Read compiled emissions as one observation per authority per year.
 *
 * The value is the net territorial total in kt CO2e across every sector and
 * gas, which is what the publisher reports and the only figure here that adds
 * over areas. Per-person intensity is deliberately not served: it is a ratio,
 * and summing or averaging it over a group of authorities would be wrong.
 */
export const localAuthorityFieldPeriods = (
	path: string,
	field: string,
	boundaryYear: number,
	geography: SourceGeography["type"] = "localAuthority",
): MeasureObservationArtifact["periods"] => {
	const source = JSON.parse(readFileSync(path, "utf8")) as PrecompiledFile;
	const periods = Object.entries(source)
		.map(([period, value]) => {
			if (!/^\d{4}$/.test(period))
				throw new Error(`${path}: invalid period ${period}`);
			const entry = object(value, `${path}.${period}`);
			if (
				entry.year !== Number(period) ||
				entry.boundaryYear !== boundaryYear ||
				entry.boundaryType !== geography
			) {
				throw new Error(
					`${path}.${period}: expected ${geography} data on the ${boundaryYear} code vintage`,
				);
			}
			const data = object(entry.data, `${path}.${period}.data`);
			return {
				period,
				records: Object.entries(data)
					.map(([areaCode, record]) => {
						if (!isPublishedAreaCode(areaCode)) {
							throw new Error(
								`${path}: unsupported area code ${areaCode}`,
							);
						}
						// A dotted field reaches into a nested breakdown,
						// which is how the census datasets are compiled.
						let observed: unknown = object(
							record,
							`${path}.${period}.${areaCode}`,
						);
						for (const segment of field.split(".")) {
							observed = object(
								observed,
								`${path}.${period}.${areaCode}`,
							)[segment];
						}
						// Not guarded by number(), which rejects negatives:
						// land use is a net sink in most rural authorities, and
						// nothing in the publisher's method stops one exceeding
						// the other sectors.
						if (
							typeof observed !== "number" ||
							!Number.isFinite(observed)
						) {
							throw new Error(
								`${path}.${period}.${areaCode}.${field} must be a finite number`,
							);
						}
						return {
							areaCode,
							value: observed,
							status: "observed" as const,
						};
					})
					.sort((left, right) =>
						left.areaCode.localeCompare(right.areaCode),
					),
			};
		})
		.sort((left, right) => left.period.localeCompare(right.period));
	if (periods.length === 0) throw new Error(`${path} has no periods`);
	return periods;
};

/**
 * One field of a single-period local-authority dataset, keeping the gaps.
 *
 * Unlike `localAuthorityFieldPeriods`, a missing or null value is not an error
 * but an absence the publisher chose, such as a survey estimate suppressed as
 * unreliable; it is returned in `absent` so the caller can name it. Rows whose
 * code is not an authority, such as a county or region total published in the
 * same table, are left out when `isAuthority` says so.
 */
export const localAuthorityFieldWithGaps = (
	path: string,
	field: string,
	boundaryYear: number,
	isAuthority: (code: string) => boolean = () => true,
	/**
	 * The table to read. Crime keeps its per-partnership records beside the
	 * authority ones, under `partnerships`, and road collisions its LSOA
	 * records under `lsoas`, in the same dataset.
	 */
	table: "data" | "partnerships" | "lsoas" = "data",
	geography: SourceGeography["type"] = "localAuthority",
	/** Required when the precompiled file holds more than one source period. */
	selectedPeriod?: string,
) => {
	const source = JSON.parse(readFileSync(path, "utf8")) as PrecompiledFile;
	const entries = Object.entries(source);
	const selected = selectedPeriod
		? entries.find(([period]) => period === selectedPeriod)
		: entries.length === 1
			? entries[0]
			: undefined;
	if (!selected) throw new Error(`${path}: expected a single period`);
	const [period, value] = selected;
	const entry = object(value, `${path}.${period}`);
	if (entry.boundaryYear !== boundaryYear || entry.boundaryType !== geography)
		throw new Error(
			`${path}.${period}: expected ${geography} data on the ${boundaryYear} code vintage`,
		);
	const records: PopulationObservation[] = [];
	const absent: string[] = [];
	for (const [areaCode, record] of Object.entries(
		object(entry[table], `${path}.${period}.${table}`),
	)) {
		if (!isPublishedAreaCode(areaCode))
			throw new Error(`${path}: unsupported area code ${areaCode}`);
		if (!isAuthority(areaCode)) continue;
		let observed: unknown = record;
		for (const segment of field.split("."))
			observed =
				observed && typeof observed === "object"
					? (observed as Record<string, unknown>)[segment]
					: undefined;
		if (observed === null || observed === undefined) {
			absent.push(areaCode);
			continue;
		}
		if (typeof observed !== "number" || !Number.isFinite(observed))
			throw new Error(
				`${path}.${period}.${areaCode}.${field} must be a finite number or absent`,
			);
		records.push({ areaCode, value: observed, status: "observed" });
	}
	records.sort((left, right) => left.areaCode.localeCompare(right.areaCode));
	return { period, records, absent: absent.sort() };
};
