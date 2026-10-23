import { createElement } from "react";
import { it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MeasureSelect from "@/components/legend/MeasureSelect";
it("offers an accessible selector for the existing life and healthy life datasets", () => {
	const html = renderToStaticMarkup(
		createElement(MeasureSelect, {
			label: "Life expectancy indicator",
			value: "hle",
			options: [
				{ value: "le", label: "Life expectancy" },
				{ value: "hle", label: "Healthy life expectancy" },
			],
			onChange: () => {},
		}),
	);
	expect(html).toContain('Life expectancy indicator');
	expect(html).toContain('value="hle" selected=""');
	expect(html).toContain("Healthy life expectancy");
});
