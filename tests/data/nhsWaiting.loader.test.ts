import { describe, expect, it } from "vitest";
import { loadNHSWaiting } from "@/lib/data/nhs-waiting/loader";

describe("loadNHSWaiting", () => {
	it("aggregates rows as they are read from the archive", async () => {
		const result = await loadNHSWaiting(async (path, visit) => {
			expect(path).toBe("health/nhs-waiting-times/rtt-mar-2026.zip");
			visit({
				"RTT Part Description": "Incomplete Pathways",
				"Provider Parent Org Code": "E54000001",
				"Provider Parent Name": "NHS Somerset ICB",
				"Total All": "100",
				"Gt 18 To 52 Weeks SUM 1": "4",
				"Gt 52 Weeks SUM 1": "3",
			});
			visit({
				"RTT Part Description": "Incomplete Pathways",
				"Provider Parent Org Code": "E54000001",
				"Provider Parent Name": "NHS Somerset ICB",
				"Total All": "50",
				"Gt 18 To 52 Weeks SUM 1": "2",
				"Gt 52 Weeks SUM 1": "1",
			});
			visit({
				"RTT Part Description": "Admitted Pathways",
				"Provider Parent Org Code": "E54000001",
				"Provider Parent Name": "NHS Somerset ICB",
				"Total All": "999",
				"Gt 18 To 52 Weeks SUM 1": "999",
				"Gt 52 Weeks SUM 1": "999",
			});
		});

		expect(result[2026]?.data).toEqual({
			E54000001: {
				icbCode: "E54000001",
				icbName: "NHS Somerset ICB",
				total: 150,
				over18Weeks: 10,
				pctOver18Weeks: 20 / 3,
			},
		});
	});
});
