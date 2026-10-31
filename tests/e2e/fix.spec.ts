import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * The sample flow on /fix, with the API answered from responses recorded
 * for public/fix/sample-wards.csv, so the test does not depend on the live
 * service.
 */
const fixture = (name: string) =>
	readFileSync(`tests/fixtures/fix/${name}.json`, "utf8");

async function mockApi(page: Page) {
	await page.route("https://api.ukdataatlas.com/v1/**", async (route) => {
		const url = new URL(route.request().url());
		const json = (body: string) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				headers: { "access-control-allow-origin": "*" },
				body,
			});
		if (route.request().method() === "OPTIONS")
			return route.fulfill({
				status: 204,
				headers: {
					"access-control-allow-origin": "*",
					"access-control-allow-methods": "GET, POST, OPTIONS",
					"access-control-allow-headers": "content-type",
				},
			});
		if (url.pathname === "/v1/boundary-releases")
			return json(fixture("boundary-releases"));
		if (url.pathname === "/v1/areas:validate")
			return json(
				fixture(
					url.searchParams.get("release")
						? "validate-sample-latest"
						: "validate-sample-inferred",
				),
			);
		const history = url.pathname.match(/\/history$/)
			? url.pathname.split("/")[5]
			: null;
		if (history) return json(fixture(`history-${history}`));
		return route.fulfill({ status: 404, body: "{}" });
	});
}

test("the sample shows what its wards are and what is wrong with them", async ({
	page,
}) => {
	await mockApi(page);
	await page.goto("/fix");

	await page.getByRole("button", { name: "Try a sample" }).click();

	await expect(page.getByLabel("Area column")).toHaveValue("0");
	const diagnosis = page.getByRole("region", { name: /What we found/ });
	await expect(diagnosis).toContainText("Wards, December 2024");
	await expect(diagnosis).toContainText("26 of 27 matched");
	await expect(diagnosis).toContainText(
		"5 codes retired since December 2024 → successors found for 5",
	);
	await expect(diagnosis).toContainText("1 value is not a valid area code");
	await expect(diagnosis).toContainText(
		"England only. Wales, Scotland and Northern Ireland not present.",
	);

	await diagnosis.getByText("Show 5 rows").click();
	await expect(diagnosis).toContainText("Became Brinkworth (E05016249)");

	const download = page.waitForEvent("download");
	await page.getByRole("button", { name: "Match report" }).click();
	expect((await download).suggestedFilename()).toBe(
		"sample-wards-match-report.csv",
	);
	await expect(page.getByText("curl -sS -X POST")).toBeVisible();
});

test("a pasted column is checked too", async ({ page }) => {
	await mockApi(page);
	await page.goto("/fix");

	await page.getByText("Or paste a column").click();
	await page
		.getByLabel(/Area codes or names, one per line/)
		.fill("E05013408\nE05013471");
	await page.getByRole("button", { name: "Check pasted data" }).click();

	await expect(
		page.getByRole("region", { name: /What we found/ }),
	).toContainText("Wards, December 2024");
});
