import { describe, expect, it, vi } from "vitest";
import { EventHandler } from "@/lib/helpers/mapManager/eventHandler";

function createMap() {
	return {
		getCanvas: () => ({ style: { cursor: "" } }),
		on: vi.fn(),
		off: vi.fn(),
		getSource: vi.fn(),
		setFeatureState: vi.fn(),
	};
}

describe("EventHandler", () => {
	it("keeps boundary handlers attached for repeated updates of the same dataset", () => {
		const map = createMap();
		const handler = new EventHandler(map as any, { onLocationChange: () => {} });
		const data = { E09000001: { value: 10 } };

		handler.setupEventHandlers(data, "LAD24CD");
		handler.setupEventHandlers(data, "LAD24CD");

		expect(map.on).toHaveBeenCalledTimes(2);
		expect(map.off).toHaveBeenCalledTimes(2);
	});

	it("reattaches handlers when the boundary code property changes", () => {
		const map = createMap();
		const handler = new EventHandler(map as any, { onLocationChange: () => {} });
		const data = { E09000001: { value: 10 } };

		handler.setupEventHandlers(data, "LAD24CD");
		handler.setupEventHandlers(data, "WD24CD");

		expect(map.on).toHaveBeenCalledTimes(4);
		expect(map.off).toHaveBeenCalledTimes(4);
	});
});
