import { expect, test } from "vitest";
import {
	datasetInput,
	parseModelInputRef,
	weightsInput,
} from "../../src/storage/modelInputRefs.ts";
import { SCOTTISH_FILE } from "../../src/notional/scotland.ts";

test("writes and reads a reference to a dataset, with or without a detail", () => {
	expect(datasetInput("census-2021-ts021")).toBe("dataset:census-2021-ts021");
	expect(parseModelInputRef("dataset:census-2021-ts021")).toEqual({
		kind: "dataset",
		slug: "census-2021-ts021",
		detail: null,
	});
	const key = datasetInput(
		"local-election",
		`${SCOTTISH_FILE}, Scottish first preferences`,
	);
	expect(parseModelInputRef(key)).toEqual({
		kind: "dataset",
		slug: "local-election",
		detail: `${SCOTTISH_FILE}, Scottish first preferences`,
	});
});

test("writes and reads a reference to a weight basis", () => {
	expect(weightsInput("population")).toBe("weights:population");
	expect(
		parseModelInputRef(
			weightsInput("population", "2019-12-uk-bgc to 2024-07-uk-bgc"),
		),
	).toEqual({
		kind: "weights",
		basis: "population",
		detail: "2019-12-uk-bgc to 2024-07-uk-bgc",
	});
});

test("leaves a series key alone, since it names no reference", () => {
	expect(
		parseModelInputRef(
			"local-election/party-votes/ward:2021-12-uk-bgc/party=con",
		),
	).toBeNull();
	expect(parseModelInputRef("weight-atoms population")).toBeNull();
});
