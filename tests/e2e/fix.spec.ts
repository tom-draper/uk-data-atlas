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
	// An empty basemap, so the map step does not reach CARTO.
	await page.route("https://basemaps.cartocdn.com/**", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ version: 8, sources: {}, layers: [] }),
		}),
	);
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
		if (url.pathname === "/v1/crosswalks")
			return json(fixture("crosswalks"));
		if (url.pathname === "/v1/lookups") return json(fixture("lookups"));
		if (
			url.pathname ===
			"/v1/lookups/crosswalk-ward-2026-05-uk-bgc-to-local-authority-2026-05-uk-bgc-clean-containment"
		)
			return route.fulfill({
				status: 200,
				contentType: "text/csv",
				headers: { "access-control-allow-origin": "*" },
				body: readFileSync(
					"tests/fixtures/fix/lookup-ward-to-local-authority.csv",
					"utf8",
				),
			});
		if (
			url.pathname ===
			"/v1/crosswalks/ward-2024-12-uk-bgc-to-local-authority-2024-12-uk-bgc-clean-containment:convert"
		)
			return json(fixture("convert-sample"));
		if (url.pathname === "/v1/map-resources/ward/2024-12-uk-bgc/tiles.json")
			return json(fixture("tiles-ward-2024-12"));
		if (url.pathname.endsWith(".mvt"))
			return route.fulfill({
				status: 204,
				headers: { "access-control-allow-origin": "*" },
			});
		if (url.pathname === "/v1/areas:validate")
			return json(
				fixture(
					url.searchParams.get("geography") === "localAuthority"
						? "validate-sample-converted"
						: url.searchParams.get("release")
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

test("the sample's codes move to the latest release, with their local authority", async ({
	page,
}) => {
	await mockApi(page);
	await page.goto("/fix");
	await page.getByRole("button", { name: "Try a sample" }).click();

	const update = page.getByRole("region", { name: /Update and add columns/ });
	await expect(update).toContainText("21 rows already in Wards, May 2026");
	await expect(update).toContainText("4 rows move to their successor");
	await expect(update).toContainText("1 row split into several areas");
	await expect(update).toContainText("1 row can't be moved");

	await update.getByLabel("Replace the old codes").check();
	await update.getByLabel("One row for each new area").check();
	await update.getByLabel("Local authority districts, May 2026").check();

	const download = page.waitForEvent("download");
	await update.getByRole("button", { name: "Download updated file" }).click();
	const file = await download;
	expect(file.suggestedFilename()).toBe("sample-wards-updated.csv");
	const text = readFileSync((await file.path())!, "utf8");
	const lines = text.trim().split("\n");
	expect(lines[0]).toBe(
		"ward_cd,area_name,local_authority_code,local_authority_name,area_update,ward_name,households",
	);
	expect(lines).toHaveLength(29);
	expect(text).toContain("E05016249,Brinkworth,E06000054,Wiltshire,updated,");
	expect(text).toContain("E0513457,,,,not a valid code,");
	await expect(update.getByRole("status")).toHaveText(
		"Your updated file is downloading.",
	);
});

test("the sample's households add up to their local authority", async ({
	page,
}) => {
	await mockApi(page);
	await page.goto("/fix");
	await page.getByRole("button", { name: "Try a sample" }).click();

	const convert = page.getByRole("region", {
		name: /Convert to another geography/,
	});
	await expect(convert.getByLabel("Convert to")).toHaveValue(
		"ward-2024-12-uk-bgc-to-local-authority-2024-12-uk-bgc-clean-containment",
	);
	await expect(convert.getByLabel("households")).toBeChecked();
	await expect(convert).toContainText(
		"households: 26 rows go in, 1 row left out",
	);

	const request = page.waitForRequest(/:convert/);
	await convert.getByRole("button", { name: "Convert", exact: true }).click();
	expect((await request).postDataJSON().rows).toHaveLength(26);
	await expect(convert).toContainText(
		"Totals for 1 area in Local authority districts, December 2024",
	);
	await expect(convert).toContainText("1 is partial");

	const download = page.waitForEvent("download");
	await convert
		.getByRole("button", { name: "Download converted file" })
		.click();
	const file = await download;
	expect(file.suggestedFilename()).toBe(
		"sample-wards-by-local-authority.csv",
	);
	expect(readFileSync((await file.path())!, "utf8")).toBe(
		"local_authority_code,local_authority_name,households,households_coverage\n" +
			"E06000054,Wiltshire,85666,partial: 26 of 98 wards\n",
	);
});

test("the sample's wards are mapped by status, or shaded by households", async ({
	page,
}) => {
	await mockApi(page);
	await page.goto("/fix");
	await page.getByRole("button", { name: "Try a sample" }).click();

	const map = page.locator('section[aria-labelledby="fix-map"]');
	await expect(
		map.getByRole("img", {
			name: "26 areas from your file on a map of Wards, December 2024",
		}),
	).toBeVisible();
	const key = map.getByRole("list", { name: "Key" });
	await expect(key).toContainText("OK: Current in Wards, May 2026");
	await expect(key).toContainText(
		"Warning: Retired since Wards, December 2024",
	);
	await expect(map).toContainText(
		"1 row isn't drawn, because the code wasn't matched.",
	);

	await map.getByLabel("Colour by").selectOption({ label: "households" });
	await expect(key.getByRole("listitem")).toHaveCount(5);
	await expect(key.getByRole("listitem").first()).toHaveText(
		"1,818 to 2,445",
	);
});
