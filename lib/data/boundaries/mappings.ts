import type { BoundaryGeojson, Features } from "@lib/types";
import type { BoundaryType } from "./boundaries";
import { getProp } from "./properties";
import { BOUNDARY_CATALOG } from "./catalog";
import { outerRings } from "@lib/types";

export type CodeType = BoundaryType;
export type YearCode = number;

export interface CodeMapping {
	[fromCode: string]: {
		[toYear: number]: string;
	};
}

export interface PrecompiledBoundaryMappings {
	version: 1;
	wardToLad: Record<string, string>;
	ladToWards: Record<number, Record<string, string[]>>;
	codeMappings: Pick<
		Record<CodeType, CodeMapping>,
		"ward" | "localAuthority" | "constituency"
	>;
	constituencyToWards: Record<number, Record<string, string[]>>;
}

export const extractWardLadMappings = (
	features: Features,
	wardCodeKeys: readonly string[],
	localAuthorityCodeKeys: readonly string[],
): {
	wardToLad: Record<string, string>;
	ladToWards: Record<string, string[]>;
} => {
	const wardToLad: Record<string, string> = {};
	const ladToWardSets: Record<string, Set<string>> = {};

	for (const feature of features) {
		const props = feature.properties;
		if (!props) continue;

		const wardCode = getProp(props, wardCodeKeys);
		const localAuthorityCode = getProp(props, localAuthorityCodeKeys);

		if (wardCode && localAuthorityCode) {
			wardToLad[wardCode] = localAuthorityCode;
			if (!ladToWardSets[localAuthorityCode]) {
				ladToWardSets[localAuthorityCode] = new Set();
			}
			ladToWardSets[localAuthorityCode].add(wardCode);
		}
	}

	return {
		wardToLad,
		ladToWards: Object.fromEntries(
			Object.entries(ladToWardSets).map(([code, wards]) => [
				code,
				[...wards],
			]),
		),
	};
};

export const buildCrossYearMappings = (
	boundaryData: Record<number, BoundaryGeojson>,
	type: Extract<CodeType, "ward" | "constituency" | "localAuthority">,
	years: number[],
): CodeMapping => {
	const mappings: CodeMapping = {};
	const codeKeys =
		type === "ward"
			? BOUNDARY_CATALOG.ward.properties.code
			: type === "constituency"
				? BOUNDARY_CATALOG.constituency.properties.code
				: BOUNDARY_CATALOG.localAuthority.properties.code;
	const nameKeys =
		type === "ward"
			? BOUNDARY_CATALOG.ward.properties.name
			: type === "constituency"
				? BOUNDARY_CATALOG.constituency.properties.name
				: BOUNDARY_CATALOG.localAuthority.properties.name;
	const nameIndex: Record<string, Set<{ code: string; year: number }>> = {};

	for (const year of years) {
		const geojson = boundaryData[year];
		if (!geojson?.features) continue;

		for (const feature of geojson.features) {
			const props = feature.properties;
			if (!props) continue;

			const code = getProp(props, codeKeys);
			const name = getProp(props, nameKeys);
			if (!code || !name) continue;

			const ladCode =
				type === "ward"
					? getProp(
							props,
							BOUNDARY_CATALOG.localAuthority.properties.code,
						)
					: null;
			// The Dec 2017 constituencies are published as "St. Albans" where
			// every other release says "St Albans", and names are all these
			// mappings have to match on, so drop abbreviation stops before
			// comparing. Only for constituencies: ward names are only
			// qualified by a local authority when the release publishes one,
			// and without that qualifier dropping stops merges same-named
			// wards in different countries.
			const plainName =
				type === "constituency"
					? name.toLowerCase().replace(/\./g, "").trim()
					: name.toLowerCase().trim();
			const normalizedName = ladCode
				? `${plainName}|${ladCode}`
				: plainName;
			(nameIndex[normalizedName] ??= new Set()).add({ code, year });
		}
	}

	for (const codeSet of Object.values(nameIndex)) {
		const codes = [...codeSet];
		for (const { code: fromCode, year: fromYear } of codes) {
			const targets = (mappings[fromCode] ??= {});
			for (const { code: toCode, year: toYear } of codes) {
				if (fromYear !== toYear) targets[toYear] = toCode;
			}
		}
	}

	return mappings;
};

function pointInPolygon(px: number, py: number, ring: number[][]): boolean {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi, yi] = ring[i];
		const [xj, yj] = ring[j];
		if (
			yi > py !== yj > py &&
			px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
		) {
			inside = !inside;
		}
	}
	return inside;
}

export const buildConstituencyWardMappings = (
	wardGeoJSON: BoundaryGeojson,
	constituencyGeoJSON: BoundaryGeojson,
): Record<string, string[]> => {
	interface Constituency {
		code: string;
		minX: number;
		minY: number;
		maxX: number;
		maxY: number;
		rings: number[][][];
	}

	const constituencies: Constituency[] = [];
	for (const feature of constituencyGeoJSON.features) {
		const code = getProp(
			feature.properties,
			BOUNDARY_CATALOG.constituency.properties.code,
		);
		if (!code) continue;

		const rings = outerRings(feature.geometry);
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const ring of rings) {
			for (const [x, y] of ring) {
				minX = Math.min(minX, x);
				minY = Math.min(minY, y);
				maxX = Math.max(maxX, x);
				maxY = Math.max(maxY, y);
			}
		}
		constituencies.push({ code, minX, minY, maxX, maxY, rings });
	}

	const mappings: Record<string, string[]> = {};
	for (const feature of wardGeoJSON.features) {
		const wardCode = getProp(
			feature.properties,
			BOUNDARY_CATALOG.ward.properties.code,
		);
		if (!wardCode) continue;

		// Only the first part is needed: this is a rough centroid for labelling.
		const [ring] = outerRings(feature.geometry);
		if (!ring) continue;
		let cx = 0;
		let cy = 0;
		for (const [x, y] of ring) {
			cx += x;
			cy += y;
		}
		cx /= ring.length;
		cy /= ring.length;

		for (const constituency of constituencies) {
			if (
				cx < constituency.minX ||
				cx > constituency.maxX ||
				cy < constituency.minY ||
				cy > constituency.maxY
			)
				continue;
			if (
				!constituency.rings.some((candidate) =>
					pointInPolygon(cx, cy, candidate),
				)
			)
				continue;
			(mappings[constituency.code] ??= []).push(wardCode);
			break;
		}
	}

	return mappings;
};
