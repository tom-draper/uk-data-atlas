import { expect, test } from "@playwright/test";

test("preserves a shared location and visualization URL", async ({ page }) => {
	await page.goto(
		"/atlas?location=North%20Wales&dataset=population&period=2022&view=age",
	);

	await expect(page).toHaveURL(
		/\/atlas\?location=North\+Wales&dataset=population&period=2022&view=age$/,
	);
	await expect(page).toHaveTitle("North Wales - UK Data Atlas");
});

test("canonicalizes an atlas URL without a visualization reference", async ({
	page,
}) => {
	await page.goto("/atlas?location=Greater%20Manchester");

	await expect(page).toHaveURL(
		/\/atlas\?location=Greater\+Manchester&dataset=local-election&period=2024$/,
	);
	await expect(page).toHaveTitle("Greater Manchester - UK Data Atlas");
});
