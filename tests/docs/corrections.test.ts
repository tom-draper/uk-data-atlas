import {
	correctionRecords,
	correctionsForMeasure,
	correctionsForMeasures,
} from "@/lib/corrections";

describe("correction register", () => {
	it("keeps source artifacts immutable for every documented change", () => {
		for (const record of correctionRecords) {
			expect(record.change.sourceArtifactsChanged).toBe(false);
		}
	});

	it("finds topic-level changes from the measures it serves", () => {
		expect(correctionsForMeasure("ghg-emissions")).toEqual(
			correctionRecords,
		);
		expect(correctionsForMeasures(["ghg-emissions"])).toEqual(
			correctionRecords,
		);
	});
});
