import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import {
	mapOptionsFromSearchParams,
	writeMapOptions,
} from "@/lib/helpers/mapOptionsUrl";

describe("map option URLs", () => {
	it("omits every default option", () => {
		const params = new URLSearchParams("period=2024");
		writeMapOptions(params, DEFAULT_MAP_OPTIONS);
		expect(params.toString()).toBe("period=2024");
	});

	it("keeps the default opacity when the URL has none", () => {
		const options = mapOptionsFromSearchParams(new URLSearchParams());
		expect(options.visibility.overlayOpacity).toBe(
			DEFAULT_MAP_OPTIONS.visibility.overlayOpacity,
		);
	});

	it("restores an explicit zero opacity", () => {
		const options = mapOptionsFromSearchParams(
			new URLSearchParams("opacity=0"),
		);
		expect(options.visibility.overlayOpacity).toBe(0);
	});

	it("round-trips non-default map and legend appearance", () => {
		const options = mapOptionsFromSearchParams(
			new URLSearchParams(
				"theme=turbo&base=darkMatter&opacity=0.25&range.housePrice=100000,500000&measure.housePrice=mean&selected.localElection=lab&excluded.localElection=con,ld&percentage.localElection=10,40",
			),
		);
		expect(options.theme.id).toBe("turbo");
		expect(options.baseStyle.id).toBe("darkMatter");
		expect(options.visibility.overlayOpacity).toBe(0.25);
		expect(options.housePrice).toMatchObject({
			measure: "mean",
			colorRange: { min: 100000, max: 500000 },
		});
		expect(options.localElection).toMatchObject({
			mode: "percentage",
			selected: "lab",
			excluded: ["con", "ld"],
			percentageRange: { min: 10, max: 40 },
		});

		const params = new URLSearchParams();
		writeMapOptions(params, options);
		expect(params.toString()).toBe(
			"theme=turbo&base=darkMatter&opacity=0.25&range.housePrice=100000%2C500000&measure.housePrice=mean&selected.localElection=lab&excluded.localElection=con%2Cld&percentage.localElection=10%2C40",
		);
	});

	it("ignores malformed and unsupported values", () => {
		const options = mapOptionsFromSearchParams(
			new URLSearchParams(
				"theme=nope&base=nope&opacity=2&range.housePrice=bad,2&measure.housePrice=median&percentage.localElection=50,10",
			),
		);
		expect(options).toEqual(DEFAULT_MAP_OPTIONS);
	});
});
