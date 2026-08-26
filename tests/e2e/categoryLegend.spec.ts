import { expect, test } from "@playwright/test";

test("selecting a local-election party filters its active chart", async ({
	page,
}) => {
	await page.goto(
		"/atlas?location=Greater%20Manchester&viz=localElection2024&type=localElection&year=2024",
	);

	const chart = page
		.locator('button[title^="House of Commons Library"]')
		.filter({ hasText: "2024 Local Elections" });
	await expect(chart).toBeVisible({ timeout: 60_000 });

	const labour = page.getByTestId("category-legend-LAB");
	await labour.click();

	await expect(labour).toHaveClass(/ring-1/);
	await expect(chart).toContainText("LAB:");
	await expect(chart).not.toContainText("CON:");
});
