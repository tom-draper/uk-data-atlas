import { describe, expect, it } from "vitest";
import {
	diagnose,
	fromExact,
	fromInferred,
	retiredCodes,
} from "@/lib/fix/diagnose";
import { latestRelease, releaseLabel } from "@/lib/fix/releases";
import { successorsIn } from "@/lib/fix/successors";
import {
	codes,
	history,
	inferred,
	latest,
	LATEST,
	releases,
	sampleInput,
} from "./sample";

describe("releases", () => {
	it("finds the newest release of a geography", () => {
		expect(latestRelease(releases, "ward")).toEqual(LATEST);
	});

	it("labels a release without its technical detail", () => {
		expect(
			releaseLabel(releases, {
				geography: "ward",
				boundaryRelease: "2024-12-uk-bgc",
			}),
		).toBe("Wards, December 2024");
	});
});

describe("successorsIn", () => {
	it("follows a code forward to the area it became", () => {
		// Brinkworth's lineage also reaches Royal Wootton Bassett South &
		// West, through the other ward the new Brinkworth was formed from.
		expect(codes(successorsIn(history("E05013408"), LATEST))).toEqual([
			"E05016249",
		]);
	});

	it("keeps only what one code became, not its neighbours' successors", () => {
		expect(codes(successorsIn(history("E05013411"), LATEST))).toEqual([
			"E05016237",
		]);
	});

	it("lists every area a split code became", () => {
		expect(
			codes(successorsIn(history("E05013446"), LATEST)).sort(),
		).toEqual(["E05016253", "E05016254"]);
	});

	it("finds nothing in a release the history does not reach", () => {
		expect(
			successorsIn(history("E05013408"), {
				geography: "ward",
				boundaryRelease: "2030-05-uk-bgc",
			}),
		).toEqual([]);
	});
});

describe("retiredCodes", () => {
	it("lists the codes the latest release no longer holds", () => {
		const retired = retiredCodes(fromInferred(inferred), latest);
		expect(retired.map((code) => code.code).sort()).toEqual([
			"E05013408",
			"E05013411",
			"E05013446",
			"E05013471",
			"E05013481",
		]);
		expect(retired[0].from).toEqual({
			geography: "ward",
			boundaryRelease: "2024-12-uk-bgc",
		});
	});

	it("reads an older code's history from the newest release holding it", () => {
		const primary = fromExact({ ...latest });
		const retired = retiredCodes(primary, null);
		expect(retired).toHaveLength(5);
		expect(retired[0].from.boundaryRelease).toBe("2024-12-uk-bgc");
	});
});

describe("diagnose", () => {
	it("names the release and how much of the column it matched", () => {
		const diagnosis = diagnose(sampleInput());
		expect(diagnosis.releaseLabel).toBe("Wards, December 2024");
		expect(diagnosis.latestLabel).toBe("Wards, May 2026");
		expect(diagnosis.matched).toBe(26);
		expect(diagnosis.total).toBe(27);
		expect(diagnosis.tiedWith[0]).toBe("Wards, May 2024");
	});

	it("says what is wrong, specifically", () => {
		const { findings } = diagnose(sampleInput());
		expect(findings.map(({ tone, title }) => `${tone}: ${title}`)).toEqual([
			"ok: 26 codes valid in Wards, December 2024",
			"warn: 5 codes retired since December 2024 → successors found for 5",
			"error: 1 value is not a valid area code",
			"info: England only. Wales, Scotland and Northern Ireland not present.",
		]);
		const retired = findings.find((finding) => finding.id === "retired");
		expect(retired?.detail).toBe(
			"Not in Wards, May 2026, the latest release. 4 have one successor, 1 split into several areas.",
		);
		expect(retired?.rows.find((row) => row.value === "E05013408")).toEqual({
			line: 4,
			value: "E05013408",
			note: "Became Brinkworth (E05016249)",
		});
	});

	it("points at the typo by its line in the file", () => {
		const malformed = diagnose(sampleInput()).findings.find(
			(finding) => finding.id === "malformed",
		);
		expect(malformed?.rows).toEqual([
			{
				line: 17,
				value: "E0513457",
				note: "An area code is a letter and eight digits; E0513457 has 7.",
			},
		]);
	});

	it("says a code's history was not read rather than that it has none", () => {
		const input = sampleInput();
		input.successors = new Map();
		const retired = diagnose(input).findings.find(
			(finding) => finding.id === "retired",
		);
		expect(retired?.title).toContain("successors found for 0");
		expect(retired?.rows[0].note).toBe("History not checked");
	});

	it("reports the latest release as current when the file is already on it", () => {
		const input = sampleInput();
		input.primary = fromExact(latest);
		input.latest = null;
		const { findings } = diagnose(input);
		expect(findings[0]).toMatchObject({
			title: "21 codes valid in Wards, May 2026",
			detail: "This is the latest release.",
		});
		expect(findings[1].title).toBe(
			"5 codes from an older release → successors found for 5",
		);
	});

	it("counts empty cells and repeats", () => {
		const input = sampleInput();
		input.emptyRows = [30];
		input.primary.values = input.primary.values.map((value, index) =>
			index === 1 ? { ...value, duplicateOf: 0 } : value,
		);
		const ids = diagnose(input).findings.map((finding) => finding.id);
		expect(ids).toContain("empty");
		expect(ids).toContain("duplicates");
	});

	it("says nothing matched when no release holds any value", () => {
		const input = sampleInput();
		input.primary = fromInferred({
			values: [],
			verdict: "unmatched",
		});
		input.latest = null;
		input.latestRelease = null;
		input.sentValues = ["E99999999", "E99999998"];
		const diagnosis = diagnose(input);
		expect(diagnosis.release).toBeNull();
		expect(diagnosis.findings.map((f) => f.title)).toEqual([
			"2 codes not recognised",
		]);
	});
});
