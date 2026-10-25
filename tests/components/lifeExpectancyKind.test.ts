import { createElement } from "react";
import { it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LifeExpectancyKindPanel } from "@/components/legend/LegendSupplementalPanels";
it("offers an accessible selector for the existing life and healthy life datasets", () => {
	const html = renderToStaticMarkup(
		createElement(LifeExpectancyKindPanel, {
			kind: "hle",
			onChange: () => {},
		}),
	);
	expect(html).toMatch(/aria-pressed="false"[^>]*>Life expectancy<\/button>/);
	expect(html).toMatch(
		/aria-pressed="true"[^>]*>Healthy life expectancy<\/button>/,
	);
});
