import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { BASE_MAP_STYLES } from "@/lib/config/baseMapStyles";
import { themes } from "@/lib/helpers/colorScale/themes";
import type {
	CategoryOptions,
	ColorRangeOption,
	MapOptions,
} from "@/lib/types/mapOptions";

const COLOR_RANGE_KEYS = Object.keys(DEFAULT_MAP_OPTIONS).filter(
	(key): key is keyof MapOptions =>
		"colorRange" in DEFAULT_MAP_OPTIONS[key as keyof MapOptions],
);
const CATEGORY_KEYS = [
	"generalElection",
	"localElection",
	"ethnicity",
] as const;
const MAP_OPTION_PARAMS = [
	"theme",
	"base",
	"data",
	"borders",
	"boundaries",
	"overlay",
	"opacity",
	...COLOR_RANGE_KEYS.flatMap((key) => [`range.${key}`]),
	...CATEGORY_KEYS.flatMap((key) => [
		`selected.${key}`,
		`excluded.${key}`,
		`percentage.${key}`,
	]),
	"measure.housePrice",
	"measure.lifeExpectancy",
	"selected.network",
	"excluded.network",
	"selected.custom",
	"excluded.custom",
];

const cloneDefaultMapOptions = (): MapOptions =>
	structuredClone(DEFAULT_MAP_OPTIONS);

function parseRange(value: string | null) {
	if (!value) return null;
	const [min, max, ...rest] = value.split(",").map(Number);
	return rest.length === 0 &&
		Number.isFinite(min) &&
		Number.isFinite(max) &&
		min <= max
		? { min, max }
		: null;
}

function writeRange(
	params: URLSearchParams,
	key: string,
	value: { min: number; max: number },
	defaultValue: { min: number; max: number },
) {
	if (value.min !== defaultValue.min || value.max !== defaultValue.max)
		params.set(`range.${key}`, `${value.min},${value.max}`);
}

/** Restores only recognised, non-default display state from an Atlas URL. */
export function mapOptionsFromSearchParams(
	params: URLSearchParams,
): MapOptions {
	const options = cloneDefaultMapOptions();
	const theme = params.get("theme");
	if (themes.some((candidate) => candidate.id === theme))
		options.theme.id = theme as MapOptions["theme"]["id"];
	const base = params.get("base");
	if (BASE_MAP_STYLES.some((candidate) => candidate.id === base))
		options.baseStyle.id = base as MapOptions["baseStyle"]["id"];

	for (const [param, key] of [
		["data", "hideDataLayer"],
		["borders", "hideBorders"],
		["boundaries", "hideBoundaryLayer"],
		["overlay", "hideOverlay"],
	] as const) {
		if (params.get(param) === "1") options.visibility[key] = true;
	}
	const opacity = Number(params.get("opacity"));
	if (Number.isFinite(opacity) && opacity >= 0 && opacity <= 1)
		options.visibility.overlayOpacity = opacity;

	for (const key of COLOR_RANGE_KEYS) {
		const range = parseRange(params.get(`range.${key}`));
		if (range) (options[key] as ColorRangeOption).colorRange = range;
	}
	const housePriceMeasure = params.get("measure.housePrice");
	if (housePriceMeasure === "mean")
		options.housePrice.measure = housePriceMeasure;
	const lifeExpectancyMeasure = params.get("measure.lifeExpectancy");
	if (lifeExpectancyMeasure === "male" || lifeExpectancyMeasure === "female")
		options.lifeExpectancy.measure = lifeExpectancyMeasure;

	for (const key of CATEGORY_KEYS) {
		const selected = params.get(`selected.${key}`);
		const excluded = params
			.get(`excluded.${key}`)
			?.split(",")
			.filter(Boolean);
		const percentageRange = parseRange(params.get(`percentage.${key}`));
		if (selected) {
			options[key].mode = "percentage";
			options[key].selected = selected;
		}
		if (excluded?.length) options[key].excluded = [...new Set(excluded)];
		if (percentageRange) options[key].percentageRange = percentageRange;
	}
	for (const key of ["network", "custom"] as const) {
		const selected = params.get(`selected.${key}`);
		const excluded = params
			.get(`excluded.${key}`)
			?.split(",")
			.filter(Boolean);
		if (key === "network") {
			if (selected) options.network.selected = selected;
			if (excluded?.length)
				options.network.excluded = [...new Set(excluded)];
		} else {
			const selectedValue =
				selected === null ? Number.NaN : Number(selected);
			if (Number.isFinite(selectedValue))
				options.custom.selectedPointValue = selectedValue;
			const excludedValues = excluded
				?.map(Number)
				.filter(Number.isFinite);
			if (excludedValues?.length)
				options.custom.excludedPointValues = [
					...new Set(excludedValues),
				];
		}
	}
	return options;
}

/** Writes a compact canonical representation, removing every default option. */
export function writeMapOptions(params: URLSearchParams, options: MapOptions) {
	for (const key of MAP_OPTION_PARAMS) params.delete(key);
	if (options.theme.id !== DEFAULT_MAP_OPTIONS.theme.id)
		params.set("theme", options.theme.id);
	if (options.baseStyle.id !== DEFAULT_MAP_OPTIONS.baseStyle.id)
		params.set("base", options.baseStyle.id);
	for (const [param, key] of [
		["data", "hideDataLayer"],
		["borders", "hideBorders"],
		["boundaries", "hideBoundaryLayer"],
		["overlay", "hideOverlay"],
	] as const) {
		if (options.visibility[key]) params.set(param, "1");
	}
	if (
		options.visibility.overlayOpacity !==
		DEFAULT_MAP_OPTIONS.visibility.overlayOpacity
	)
		params.set("opacity", String(options.visibility.overlayOpacity));
	for (const key of COLOR_RANGE_KEYS) {
		writeRange(
			params,
			key,
			(options[key] as ColorRangeOption).colorRange,
			(DEFAULT_MAP_OPTIONS[key] as ColorRangeOption).colorRange,
		);
	}
	if (options.housePrice.measure !== DEFAULT_MAP_OPTIONS.housePrice.measure)
		params.set("measure.housePrice", options.housePrice.measure);
	if (
		options.lifeExpectancy.measure !==
		DEFAULT_MAP_OPTIONS.lifeExpectancy.measure
	)
		params.set("measure.lifeExpectancy", options.lifeExpectancy.measure);
	for (const key of CATEGORY_KEYS) {
		const option = options[key] as CategoryOptions;
		const defaultOption = DEFAULT_MAP_OPTIONS[key] as CategoryOptions;
		if (option.mode === "percentage" && option.selected)
			params.set(`selected.${key}`, option.selected);
		if (option.excluded?.length)
			params.set(
				`excluded.${key}`,
				[...option.excluded].sort().join(","),
			);
		if (
			option.percentageRange.min !== defaultOption.percentageRange.min ||
			option.percentageRange.max !== defaultOption.percentageRange.max
		)
			params.set(
				`percentage.${key}`,
				`${option.percentageRange.min},${option.percentageRange.max}`,
			);
	}
	if (options.network.selected)
		params.set("selected.network", options.network.selected);
	if (options.network.excluded?.length)
		params.set(
			"excluded.network",
			[...options.network.excluded].sort().join(","),
		);
	if (options.custom.selectedPointValue !== undefined)
		params.set(
			"selected.custom",
			String(options.custom.selectedPointValue),
		);
	if (options.custom.excludedPointValues?.length)
		params.set(
			"excluded.custom",
			[...options.custom.excludedPointValues]
				.sort((a, b) => a - b)
				.join(","),
		);
}
