/**
 * How each kind of choropleth is coloured. Pure descriptions of a fill: no map,
 * no layers, so the colour rules can be read and tested on their own.
 */
import { Party, PartyCode } from "@lib/types/common";
import { MapOptions } from "@lib/types/mapOptions";
import { PARTIES } from "@/lib/data/election/parties";
import { ETHNICITY_COLORS } from "../colorScale/ethnicityColors";
import { getPercentageColorExpression } from "../colorScale/datasetColors";
import {
	categoryMatch,
	featureProperty,
	hoverOpacity,
	type FillPaintConfig,
	type MapExpression,
} from "../mapManager/expressions";

const NO_DATA_COLOR = "#cccccc";

/** A flat fill at the overlay's own opacity, for the percentage views. */
const flatOpacity = (opacity: number) => opacity;

/** Each area in the colour of the party that won it. */
export function electionWinnerPaint(partyInfo: Party[]): FillPaintConfig {
	return {
		color: categoryMatch(
			"winningParty",
			partyInfo.map(
				(party) => [party.key, PARTIES[party.key].color] as const,
			),
			NO_DATA_COLOR,
		),
		opacity: hoverOpacity,
	};
}

/** One party's vote share, shaded from its own colour. */
export function partyPercentagePaint(
	options: MapOptions["localElection"] | MapOptions["generalElection"],
	isDark: boolean,
): FillPaintConfig | null {
	if (!options.selected) return null;
	const baseColor =
		PARTIES[options.selected as PartyCode]?.color || "#999999";
	return {
		color: getPercentageColorExpression(baseColor, options, isDark),
		opacity: flatOpacity,
	};
}

/** Each area in the colour of its largest ethnic group. */
export function ethnicityMajorityPaint(): FillPaintConfig {
	return {
		color: categoryMatch(
			"majorityCategory",
			Object.entries(ETHNICITY_COLORS),
			NO_DATA_COLOR,
		),
		opacity: hoverOpacity,
	};
}

/** One ethnic group's share, shaded from that group's colour. */
export function ethnicityPercentagePaint(
	options: MapOptions["ethnicity"],
	isDark: boolean,
): FillPaintConfig | null {
	if (!options.selected) return null;
	return {
		color: getPercentageColorExpression(
			ETHNICITY_COLORS[options.selected],
			options,
			isDark,
		),
		opacity: flatOpacity,
	};
}

/** A colour the feature builder already worked out per feature. */
export function featureColorPaint(): FillPaintConfig {
	return { color: featureProperty("color"), opacity: hoverOpacity };
}

/** A value shaded along a prepared colour ramp. */
export function valuePaint(colorExpression: MapExpression): FillPaintConfig {
	return { color: colorExpression, opacity: hoverOpacity };
}
