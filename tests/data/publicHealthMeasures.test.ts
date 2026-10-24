import { it, expect } from "vitest";
import { loadPublicHealth } from "@uk-data-atlas/datasets/data/public-health/loader";
import { averagePublicHealth } from "@/lib/datasets/publicHealth";
it("uses the latest common indicator period without falling back past suppression", async () => {
	const row = {
		"Indicator ID": "92443",
		Age: "18+ yrs",
		Sex: "Persons",
		Category: "",
		"Category Type": "",
		"Area Type": "Counties & UAs (from Apr 2023)",
		"Area Code": "E06000001",
		"Area Name": "Area",
		"Time period Sortable": "20240000",
		"Time period": "2024",
		Value: "12",
	};
	const data = await loadPublicHealth(async (path, _options, visit) => {
		if (!path.includes("health-improvement")) return;
		visit({
			...row,
			"Time period Sortable": "20230000",
			"Time period": "2023",
			Value: "20",
		});
		visit(row);
		visit({ ...row, "Area Code": "E06000002", Value: ".." });
		visit({ ...row, Sex: "Male", Value: "99" });
	});
	expect(data[2025].data.E06000001.metrics.smoking).toBe(12);
	expect(data[2025].data.E06000002).toBeUndefined();
	expect(data[2025].periods.smoking).toBe("2024");
	expect(
		averagePublicHealth([
			{ code: "1", name: "A", metrics: { smoking: 10 } },
			{ code: "2", name: "B", metrics: { smoking: 20, activity: 60 } },
		])?.metrics,
	).toEqual({ smoking: 15, activity: 60 });
});
