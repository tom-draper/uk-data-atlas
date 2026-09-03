// lib/utils/mapManager/featureBuilder.ts
import {
	BoundaryGeojson,
	PropertyKeys,
	Feature,
	Features,
	getFeatureProp,
} from "@lib/types/geometry";
import {
	LocalElectionDataset,
	GeneralElectionDataset,
} from "@lib/types/elections";
import { EthnicityDataset } from "@lib/types/ethnicity";
import {
	BrexitLADDataset,
	BrexitConstituencyDataset,
} from "@lib/types/referendum";
import { MapOptions } from "@lib/types/mapOptions";
import { polygonAreaSqKm } from "../population";
import { getColorForBrexitLeave } from "../colorScale/datasetColors";
import { getColor } from "../colorScale/themes";
import { CustomPoint } from "@/lib/types/custom";

export const DEFAULT_COLOR = "#cccccc";

// Cache computed area per feature geometry — avoids re-traversing polygon vertices across dataset switches
const featureAreaCache = new WeakMap<object, number>();

function getCachedArea(feature: Feature): number {
	const geom = feature.geometry.coordinates as object;
	let area = featureAreaCache.get(geom);
	if (area === undefined) {
		area = polygonAreaSqKm(feature.geometry);
		featureAreaCache.set(geom, area);
	}
	return area;
}

export class FeatureBuilder {
	formatBoundaryGeoJson(features: Features): BoundaryGeojson {
		return {
			type: "FeatureCollection",
			crs: { type: "", properties: { name: "" } },
			features,
		};
	}

	private mapFeatures<T extends Record<string, unknown>>(
		features: Features,
		addProperties: (feature: Feature, index: number) => T,
	): Features {
		return features.map((feature, i) => ({
			...feature,
			properties: {
				...feature.properties,
				...addProperties(feature, i),
			},
		}));
	}

	// Adds a `color` property to each feature, derived from the area code (and
	// optionally the feature itself). `colorFor` returns DEFAULT_COLOR for areas
	// with no data.
	private buildColorFeatures(
		features: Features,
		codeProp: PropertyKeys,
		colorFor: (code: string, feature: Feature) => string,
	): Features {
		return this.mapFeatures(features, (feature) => ({
			color: colorFor(
				getFeatureProp(feature.properties, codeProp) ?? "",
				feature,
			),
		}));
	}

	// Numeric map datasets keep a stable raw value in the source. Their colour is
	// then calculated by a MapLibre paint expression, avoiding a fresh feature
	// collection whenever a range slider or theme changes.
	buildValueFeatures(
		features: Features,
		codeProp: PropertyKeys,
		valueFor: (code: string, feature: Feature) => number | null | undefined,
	): Features {
		return this.mapFeatures(features, (feature) => {
			const value = valueFor(
				getFeatureProp(feature.properties, codeProp) ?? "",
				feature,
			);
			return { value: Number.isFinite(value) ? value : null };
		});
	}

	getFeatureAreaSqKm(feature: Feature): number {
		return getCachedArea(feature);
	}

	buildElectionWinnerFeatures(
		features: Features,
		codeProp: string,
		getWinner: (code: string) => string,
	): Features {
		return this.mapFeatures(features, (feature) => ({
			winningParty: getWinner(
				getFeatureProp(feature.properties, codeProp) ?? "",
			),
		}));
	}

	buildElectionPercentageFeatures(
		features: Features,
		data: LocalElectionDataset["data"] | GeneralElectionDataset["data"],
		partyCode: string,
		codeProp: PropertyKeys,
	): Features {
		const totalVotesMap = new Map<string, number>();
		for (const [code, loc] of Object.entries(data)) {
			if (loc?.partyVotes) {
				let total = 0;
				for (const v of Object.values(loc.partyVotes))
					total += (v as number) ?? 0;
				totalVotesMap.set(code, total);
			}
		}

		return this.mapFeatures(features, (feature) => {
			const code = getFeatureProp(feature.properties, codeProp) ?? "";
			const locationData = data[code];
			let percentage = 0;
			if (locationData?.partyVotes) {
				const partyVotes = locationData.partyVotes[partyCode] ?? 0;
				const totalVotes = totalVotesMap.get(code) ?? 0;
				percentage =
					totalVotes > 0 ? (partyVotes / totalVotes) * 100 : 0;
			}
			return { percentage, partyCode };
		});
	}

	buildEthnicityFeatures(
		features: Features,
		dataset: EthnicityDataset,
		codeProp: string,
		options: MapOptions,
	): Features {
		const mode = options.ethnicity?.mode || "majority";
		const excluded = new Set(options.ethnicity?.excluded ?? []);

		if (mode === "percentage" && options.ethnicity?.selected) {
			return this.buildEthnicityPercentageFeatures(
				features,
				dataset.data,
				options.ethnicity.selected,
				codeProp,
			);
		}

		return this.buildEthnicityMajorityFeatures(
			features,
			codeProp,
			dataset.results,
			excluded.size > 0 ? dataset.data : undefined,
			excluded.size > 0 ? excluded : undefined,
		);
	}

	buildEthnicityMajorityFeatures(
		features: Features,
		codeProp: string,
		results: EthnicityDataset["results"],
		data?: EthnicityDataset["data"],
		excluded?: Set<string>,
	): Features {
		return this.mapFeatures(features, (feature) => {
			const code = getFeatureProp(feature.properties, codeProp) ?? "";

			if (excluded && excluded.size > 0 && data) {
				const parentCategories = data[code];
				if (parentCategories) {
					let maxPopulation = 0;
					let majorityCategory = "NONE";
					for (const subcategories of Object.values(
						parentCategories,
					)) {
						for (const [name, d] of Object.entries(subcategories)) {
							if (
								!excluded.has(name) &&
								d.population > maxPopulation
							) {
								maxPopulation = d.population;
								majorityCategory = name;
							}
						}
					}
					return { majorityCategory };
				}
			}

			return { majorityCategory: results[code] || "NONE" };
		});
	}

	buildEthnicityPercentageFeatures(
		features: Features,
		data: EthnicityDataset["data"],
		ethnicity: string,
		codeProp: string,
	): Features {
		const totals = new Map<string, { total: number; count: number }>();
		for (const [code, locationData] of Object.entries(data)) {
			let total = 0;
			let count = 0;
			for (const category of Object.values(locationData)) {
				for (const [eth, d] of Object.entries(category)) {
					total += d.population || 0;
					if (eth === ethnicity) count = d.population || 0;
				}
			}
			totals.set(code, { total, count });
		}

		return this.mapFeatures(features, (feature) => {
			const code = getFeatureProp(feature.properties, codeProp) ?? "";
			const { total = 0, count = 0 } = totals.get(code) ?? {};
			const percentage = total > 0 ? (count / total) * 100 : 0;
			return { percentage, categoryCode: ethnicity };
		});
	}

	// Builds a GeoJSON FeatureCollection of points, each coloured by its value
	// against the dataset's value range. Used by the custom point render path.
	buildPointCollection(
		points: CustomPoint[],
		valueMin: number,
		valueMax: number,
		themeId: string,
		colorByValue?: Record<number, string>,
	): GeoJSON.FeatureCollection {
		const range = valueMax - valueMin || 1;
		return {
			type: "FeatureCollection",
			features: points.map((p) => ({
				type: "Feature",
				geometry: { type: "Point", coordinates: [p.lng, p.lat] },
				properties: {
					value: p.value,
					color:
						colorByValue?.[p.value] ??
						getColor((p.value - valueMin) / range, themeId),
					label: p.label ?? "",
					...Object.fromEntries(
						(p.details ?? []).map((detail, index) => [
							`detail${index}`,
							detail,
						]),
					),
				},
			})),
		};
	}

	buildBrexitConstituencyFeatures(
		features: Features,
		dataset: BrexitConstituencyDataset,
		constituencyCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.buildColorFeatures(
			features,
			constituencyCodeProp,
			(code) => {
				const area = dataset.data[code];
				return area
					? getColorForBrexitLeave(
							area.pctLeave,
							mapOptions.brexitConstituency,
						)
					: DEFAULT_COLOR;
			},
		);
	}

	buildBrexitFeatures(
		features: Features,
		dataset: BrexitLADDataset,
		ladCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.buildColorFeatures(features, ladCodeProp, (code) => {
			const area = dataset.data[code];
			return area
				? getColorForBrexitLeave(area.pctLeave, mapOptions.brexit)
				: DEFAULT_COLOR;
		});
	}
}
