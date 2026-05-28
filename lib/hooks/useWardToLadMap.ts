// lib/hooks/useWardLadMap.ts
"use client";

import { useState } from "react";
import { Features } from "@lib/types";

/**
 * Hook to manage ward-to-LAD mappings
 * Pass this hook to both boundary and election data loaders
 */
export function useWardLadMap() {
	const [wardToLadMap, setWardToLadMap] = useState<Record<string, string>>(
		{},
	);

	const getLadForWard = (wardCode: string) => {
		return wardToLadMap[wardCode];
	};

	const addWardLadMapping = (wardCode: string, ladCode: string) => {
		if (wardCode && ladCode) {
			setWardToLadMap((prev) => ({
				...prev,
				[wardCode]: ladCode,
			}));
		}
	};

	const addWardLadMappings = (mappings: Record<string, string>) => {
		setWardToLadMap((prev) => ({
			...prev,
			...mappings,
		}));
	};

	const clearWardLadMap = () => {
		setWardToLadMap({});
	};

	const getMappingCount = () => {
		return Object.keys(wardToLadMap).length;
	};

	return {
		getLadForWard,
		addWardLadMapping,
		addWardLadMappings,
		clearWardLadMap,
		getMappingCount,
	};
}

/**
 * Utility to extract ward-to-LAD mappings from GeoJSON features
 */
export const extractWardLadMappings = (
	features: Features,
	wardCodeKeys: readonly string[],
	ladCodeKeys: readonly string[],
): Record<string, string> => {
	const mappings: Record<string, string> = {};

	for (const feature of features) {
		const props = feature.properties as unknown as Record<
			string,
			string | undefined
		>;

		// Find ward code
		let wardCode: string | undefined;
		for (const key of wardCodeKeys) {
			const val = props[key];
			if (val) {
				wardCode = val;
				break;
			}
		}

		// Find LAD code
		let ladCode: string | undefined;
		for (const key of ladCodeKeys) {
			const val = props[key];
			if (val) {
				ladCode = val;
				break;
			}
		}

		if (wardCode && ladCode) {
			mappings[wardCode] = ladCode;
		}
	}

	return mappings;
};
