import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SparklineBackground } from "@/components/measures/SparklineBackground";
import { sparkline } from "@/lib/measures/series";

const line = sparkline([1, 2, 3], { margin: 0.3, padY: 12 })!;
const render = (marker?: boolean) =>
	renderToStaticMarkup(
		createElement(SparklineBackground, {
			sparkline: line,
			color: "#3b82f6",
			gradientId: "g-test",
			fade: [
				{ offset: "0%", opacity: 0.2 },
				{ offset: "80%", opacity: 0 },
			],
			strokeWidth: 1.5,
			marker,
		}),
	);

describe("SparklineBackground", () => {
	it("draws the fill and line with the given colour, fade and weight", () => {
		const html = render();
		expect(html).toContain('id="g-test"');
		expect(html).toContain('fill="url(#g-test)"');
		expect(html).toContain(`d="${line.areaPath}"`);
		expect(html).toContain(`d="${line.linePath}"`);
		expect(html).toContain('stroke="#3b82f6"');
		expect(html).toContain('stroke-width="1.5"');
		expect(html).toContain('stop-opacity="0.2"');
		expect(html).toContain('offset="80%"');
	});

	it("marks the latest value only when asked", () => {
		expect(render()).not.toContain("<circle");
		const html = render(true);
		expect(html).toContain("<circle");
		expect(html).toContain(`cx="${line.last.x}"`);
		expect(html).toContain(`cy="${line.last.y}"`);
	});
});
