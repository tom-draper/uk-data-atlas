// lib/types/mapOptions.ts
import { Datasets } from "./datasets";
import { ColorRange } from "@uk-data-atlas/datasets/types/common";
import type { BaseMapStyle } from "../config/baseMapStyles";
import type { CatalogueDatasetType } from "@/lib/data/catalog";

// Base option types reused across visualizations
export interface ColorRangeOption {
	colorRange: ColorRange;
}

export interface HousePriceOptions extends ColorRangeOption {
	measure: "median" | "mean";
}

export interface IncomeOptions extends ColorRangeOption {
	period: "annual" | "hourly";
	measure: "median" | "mean";
}

export interface CountMetricOptions extends ColorRangeOption {
	measure: "total" | "perPopulation";
}

export interface WasteOptions extends CountMetricOptions {
	metric: "collected" | "recycled" | "recyclingShare";
}

export interface EnergyConsumptionOptions extends CountMetricOptions {
	sector: "allMetersGwh" | "domesticGwh" | "nonDomesticGwh";
}

export interface BroadbandOptions extends ColorRangeOption {
	measure: "fullFibre" | "superfast" | "ultrafast" | "gigabit";
}

export interface AirQualityOptions extends ColorRangeOption {
	measure: "no2" | "pm25" | "pm10";
}

export interface GhgEmissionsOptions extends ColorRangeOption {
	measure:
		| "perPerson"
		| "total"
		| "excludingLandUse"
		| "transport"
		| "domestic"
		| "industry"
		| "commercial"
		| "publicSector"
		| "agriculture"
		| "waste"
		| "landUse";
}

export interface UnemploymentOptions extends ColorRangeOption {
	measure: "rate" | "count";
}

export interface ClaimantCountOptions extends ColorRangeOption {
	measure: "rate" | "count";
}

export interface HomelessnessOptions extends ColorRangeOption {
	measure: "rate" | "count";
}

export interface SchoolPerformanceOptions extends ColorRangeOption {
	measure: "grade4" | "grade5" | "attainment8" | "progress8";
}

export interface LifeExpectancyOptions extends ColorRangeOption {
	measure: "average" | "male" | "female";
}

export interface RegionalGdpItl3Options extends ColorRangeOption {
	measure: "gdp" | "gva";
}

export interface MobileCoverageOptions extends ColorRangeOption {
	measure:
		| "pct5GOutdoorAll"
		| "pct5GOutdoorAny"
		| "pct4GIndoorAll"
		| "pct4GIndoorAny"
		| "pct4GGeoAll"
		| "pct5GGeoAny";
}

export interface FuelPovertyOptions extends ColorRangeOption {
	measure: "rate" | "count";
}

export interface ImdOptions extends ColorRangeOption {
	measure:
		| "imdScore"
		| "incomeScore"
		| "employmentScore"
		| "educationScore"
		| "healthScore"
		| "crimeScore"
		| "housingScore"
		| "livingEnvironmentScore";
}

export interface PlanningApplicationsOptions extends ColorRangeOption {
	measure: "received" | "decided" | "withdrawn";
}

export interface WorkplaceIncomeOptions extends ColorRangeOption {
	measure: "annualMedian" | "annualMean" | "hourlyMedian" | "hourlyMean";
}

export interface HousingTenureOptions extends ColorRangeOption {
	measure:
		| "owned"
		| "outright"
		| "mortgage"
		| "shared"
		| "social"
		| "private"
		| "rentFree";
}

export interface GeneralHealthOptions extends ColorRangeOption {
	measure: "goodHealth" | "veryGood" | "good" | "fair" | "bad" | "veryBad";
}

export interface PupilAbsenceOptions extends ColorRangeOption {
	measure:
		"overall" | "authorised" | "unauthorised" | "persistent" | "severe";
}

export interface PublicHealthOptions extends ColorRangeOption {
	measure:
		| "smoking"
		| "adultExcessWeight"
		| "activity"
		| "receptionExcessWeight"
		| "year6ExcessWeight"
		| "preventableMortality";
}

export interface CustomOptions extends ColorRangeOption {
	selectedPointValue?: number;
	excludedPointValues?: number[];
}

export interface CategoryOptions {
	mode: "majority" | "percentage";
	metric?: "votes" | "turnout";
	selected?: string;
	excluded?: string[];
	percentageRange: ColorRange;
	turnoutRange?: ColorRange;
}

/** Click-to-isolate / right-click-to-exclude state for a map-native network layer's legend. */
export interface NetworkOptions {
	selected?: string;
	excluded?: string[];
}

export type ChartMapOptions = Omit<
	Record<CatalogueDatasetType, ColorRangeOption>,
	| "regionalGdpItl3"
	| "mobileCoverage"
	| "fuelPoverty"
	| "imd"
	| "planningApplications"
	| "workplaceIncome"
	| "housingTenure"
	| "generalHealth"
	| "pupilAbsence"
	| "publicHealth"
	| "housePrice"
	| "income"
	| "lifeExpectancy"
	| "businessActivity"
	| "electricVehicleChargers"
	| "electricityConsumption"
	| "gasConsumption"
	| "waste"
	| "jobs"
	| "broadband"
	| "airQuality"
	| "ghgEmissions"
	| "unemployment"
	| "claimantCount"
	| "homelessness"
	| "schoolPerformance"
> & {
	regionalGdpItl3: RegionalGdpItl3Options;
	mobileCoverage: MobileCoverageOptions;
	fuelPoverty: FuelPovertyOptions;
	imd: ImdOptions;
	planningApplications: PlanningApplicationsOptions;
	workplaceIncome: WorkplaceIncomeOptions;
	housingTenure: HousingTenureOptions;
	generalHealth: GeneralHealthOptions;
	pupilAbsence: PupilAbsenceOptions;
	publicHealth: PublicHealthOptions;
	housePrice: HousePriceOptions;
	income: IncomeOptions;
	businessActivity: CountMetricOptions;
	electricVehicleChargers: CountMetricOptions;
	electricityConsumption: EnergyConsumptionOptions;
	gasConsumption: EnergyConsumptionOptions;
	waste: WasteOptions;
	jobs: CountMetricOptions;
	broadband: BroadbandOptions;
	airQuality: AirQualityOptions;
	ghgEmissions: GhgEmissionsOptions;
	unemployment: UnemploymentOptions;
	claimantCount: ClaimantCountOptions;
	homelessness: HomelessnessOptions;
	schoolPerformance: SchoolPerformanceOptions;
	lifeExpectancy: LifeExpectancyOptions;
};

export type ColorTheme =
	| "viridis"
	| "plasma"
	| "redblue"
	| "ryg"
	| "brownteal"
	| "purpleorange"
	| "pinkgreen"
	| "ylorrd"
	| "purplered"
	| "turbo"
	| "coolwarm"
	| "spectral"
	| "ylgnbu"
	| "ylgn";

export type MapMode = keyof Datasets | "custom";

/**
 * The dataset types whose map options carry a colour range, so the shared
 * choropleth path can read `mapOptions[dataset.type].colorRange` without a
 * cast. Derived, so a new option group joins or leaves it automatically.
 */
export type NumericMapOptionsKey = Extract<
	MapMode,
	{
		[K in keyof MapOptions]: MapOptions[K] extends ColorRangeOption
			? K
			: never;
	}[keyof MapOptions]
>;

export type MapOptions = ChartMapOptions & {
	generalElection: CategoryOptions;
	localElection: CategoryOptions;
	ethnicity: CategoryOptions;
	ageDistribution: ColorRangeOption;
	populationDensity: ColorRangeOption;
	gender: ColorRangeOption;
	brexit: ColorRangeOption;
	brexitConstituency: ColorRangeOption;
	custom: CustomOptions;
	network: NetworkOptions;
	theme: {
		id: ColorTheme;
	};
	baseStyle: {
		id: BaseMapStyle["id"];
	};
	visibility: {
		hideDataLayer: boolean;
		hideBorders: boolean;
		hideBoundaryLayer: boolean;
		hideOverlay: boolean;
		overlayOpacity: number;
	};
};

export type ColorRangeMapOptionKey = {
	[Key in keyof MapOptions]: MapOptions[Key] extends ColorRangeOption
		? Key
		: never;
}[keyof MapOptions];
