import { expect, test } from "@playwright/test";

test("the Data menu opens, closes on Escape and on an outside click", async ({
	page,
}) => {
	await page.goto("/fix");

	const nav = page.getByRole("navigation").first();
	const data = nav.getByRole("button", { name: "Data" });
	const boundaries = nav.getByRole("link", { name: "Boundaries" });

	await expect(data).toHaveAttribute("aria-expanded", "false");
	await expect(boundaries).toBeHidden();

	await data.click();
	await expect(data).toHaveAttribute("aria-expanded", "true");
	await expect(nav.getByRole("link", { name: "Datasets" })).toHaveAttribute(
		"href",
		"/datasets",
	);
	await expect(boundaries).toHaveAttribute("href", "/geographies");

	await page.keyboard.press("Escape");
	await expect(data).toHaveAttribute("aria-expanded", "false");
	await expect(data).toBeFocused();

	await data.click();
	await expect(boundaries).toBeVisible();
	await page.mouse.click(5, 400);
	await expect(data).toHaveAttribute("aria-expanded", "false");
});

test("the nav links the pages visitors look for", async ({ page }) => {
	await page.goto("/fix");

	const nav = page.getByRole("navigation").first();
	for (const [name, href] of [
		["Maps", "/maps"],
		["Places", "/places"],
		["Fix your data", "/fix"],
		["API", "/docs/v1"],
	]) {
		await expect(
			nav.getByRole("link", { name, exact: true }),
		).toHaveAttribute("href", href);
	}
	await expect(nav.getByRole("link", { name: "Atlas" })).toHaveCount(0);
});
