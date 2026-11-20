import { describe, expect, it } from "vitest";
import {
	DATASET_DECLARATIONS,
	declarationProblems,
	defineDataset,
	type DatasetDeclaration,
} from "@uk-data-atlas/datasets";

const base = DATASET_DECLARATIONS.find(({ id }) => id === "claimant-count")!;

/** The real declaration with one fault, as a dataset author might write it. */
const faulty = (change: (copy: any) => void): DatasetDeclaration => {
	const copy = structuredClone({
		...base,
		statistics: {
			...base.statistics,
			period: undefined,
			computed: undefined,
			direct: undefined,
		},
		display: { ...base.display, aggregation: undefined },
	});
	change(copy);
	return copy as unknown as DatasetDeclaration;
};

describe("declaration validation", () => {
	it("finds nothing wrong with any declared dataset", () => {
		for (const declaration of DATASET_DECLARATIONS)
			expect(declarationProblems(declaration), declaration.id).toEqual(
				[],
			);
	});

	it("starts from a declaration with no problems", () => {
		expect(declarationProblems(faulty(() => {}))).toEqual([]);
	});

	it.each([
		[
			"a guide with no title",
			(d: any) => (d.guide.title = ""),
			"guide.title is empty",
		],
		[
			"a blank optional guide summary",
			(d: any) => (d.guide.summary = " "),
			"guide.summary is empty, leave it out instead",
		],
		[
			"a source folder with an empty name",
			(d: any) => (d.sources = [{ name: "" }]),
			"a source folder has an empty name",
		],
		[
			"an empty source list",
			(d: any) => (d.sources = []),
			"sources is empty, leave it out to read the folder named for the id",
		],
		[
			"a blank source term",
			(d: any) => (d.source.licence = " "),
			"source.licence is empty",
		],
		[
			"a licence URL that is not a URL",
			(d: any) => (d.source.licenceUrl = "licence"),
			"source.licenceUrl is not an http(s) URL",
		],
		[
			"an unknown cadence",
			(d: any) => (d.source.cadence = "weekly"),
			"source.cadence weekly is not a known cadence",
		],
		[
			"a repeated measure",
			(d: any) => d.statistics.measures.push(d.statistics.measures[0]),
			"statistics.measures repeats claimants",
		],
		[
			"a measure with no unit",
			(d: any) => (d.statistics.measures[0].unit = ""),
			"measure claimants has no unit",
		],
		[
			"a member whose parent is not a member",
			(d: any) => (d.statistics.dimensions[0].members[1].parent = "x"),
			"dimension age-group member youthCount has parent x, which is not a member",
		],
		[
			"a field reading an undeclared measure",
			(d: any) => (d.statistics.fields[1].measure = "nope"),
			"field totalRate reads measure nope, which is not declared",
		],
		[
			"a field binding an undeclared dimension",
			(d: any) => (d.statistics.fields[0].path = "{sex}"),
			"field {sex} binds dimension sex, which is not declared",
		],
		[
			"an indicator reading an undeclared measure",
			(d: any) => (d.catalogue.indicators[0].measure = "nope"),
			"indicator claimant-count reads measure nope, which is not declared",
		],
		[
			"an indicator naming an undeclared member",
			(d: any) => (d.catalogue.indicators[0].members["age-group"] = "75"),
			"indicator claimant-count names age-group member 75, which the dimension does not declare",
		],
		[
			"an indicator naming an undeclared dimension",
			(d: any) => (d.catalogue.indicators[0].members = { sex: "male" }),
			"indicator claimant-count names dimension sex, which is not declared",
		],
		[
			"an indicator whose field is declared as another series",
			(d: any) => (d.catalogue.indicators[0].field = "totalRate"),
			"indicator claimant-count reads field totalRate, which is declared as a different series",
		],
		[
			"a stateful authority pattern",
			(d: any) => (d.catalogue.authorityCodes = /^E0/g),
			"catalogue.authorityCodes must not be global or sticky",
		],
		[
			"a repeated indicator",
			(d: any) => d.catalogue.indicators.push(d.catalogue.indicators[0]),
			"catalogue repeats indicator claimant-count",
		],
		[
			"a catalogue with no period",
			(d: any) => delete d.catalogue.period,
			"catalogue needs a period, or yearly",
		],
		[
			"a repeated display measure",
			(d: any) => (d.display.measures[1].id = "rate"),
			"display.measures repeats rate",
		],
		[
			"an empty colour range",
			(d: any) => (d.display.measures[0].colorRange = { min: 5, max: 5 }),
			"display measure rate has an empty colorRange",
		],
		[
			"a headline for no places",
			(d: any) => (d.placeHeadline.places = []),
			"placeHeadline.places is empty",
		],
	])("rejects %s", (_name, change, expected) => {
		const declaration = faulty(change);
		expect(declarationProblems(declaration)).toContain(expected);
		expect(() => defineDataset(declaration as never)).toThrow(expected);
	});
});
