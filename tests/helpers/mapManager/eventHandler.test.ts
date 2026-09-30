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
		const handler = new EventHandler(map as any, {
			onLocationChange: () => {},
		});
		const data = { E09000001: { value: 10 } };

		handler.setupEventHandlers(data, "LAD24CD");
		handler.setupEventHandlers(data, "LAD24CD");

		expect(map.on).toHaveBeenCalledTimes(3);
		expect(map.off).toHaveBeenCalledTimes(3);
	});

	it("reattaches handlers when the boundary code property changes", () => {
		const map = createMap();
		const handler = new EventHandler(map as any, {
			onLocationChange: () => {},
		});
		const data = { E09000001: { value: 10 } };

		handler.setupEventHandlers(data, "LAD24CD");
		handler.setupEventHandlers(data, "WD24CD");

		expect(map.on).toHaveBeenCalledTimes(6);
		expect(map.off).toHaveBeenCalledTimes(6);
	});

	it("locks an area on click until the same area is clicked again", () => {
		const map = createMap();
		const onAreaHover = vi.fn();
		const onAreaClick = vi.fn();
		const handler = new EventHandler(map as any, {
			onAreaHover,
			onAreaClick,
			onLocationChange: () => {},
		});
		const data = {
			E09000001: { value: 10 },
			E09000002: { value: 20 },
		};
		const feature = (id: number, code: string) => ({
			id,
			properties: { LAD24CD: code, LAD24NM: `Area ${id}` },
		});

		handler.setupEventHandlers(data, "LAD24CD");
		const click = map.on.mock.calls.find(
			([event]) => event === "click",
		)?.[2] as (event: { features: ReturnType<typeof feature>[] }) => void;

		click({ features: [feature(1, "E09000001")] });
		(handler as any).handleMouseMove({
			features: [feature(2, "E09000002")],
		});
		click({ features: [feature(2, "E09000002")] });

		expect(onAreaClick).toHaveBeenCalledTimes(1);
		expect(onAreaClick).toHaveBeenCalledWith(
			expect.objectContaining({
				code: "E09000001",
				type: "localAuthority",
			}),
		);
		expect(onAreaHover).not.toHaveBeenCalled();

		click({ features: [feature(1, "E09000001")] });
		(handler as any).handleMouseMove({
			features: [feature(2, "E09000002")],
		});

		expect(onAreaClick).toHaveBeenCalledTimes(2);
		expect(onAreaHover).toHaveBeenCalledWith(
			expect.objectContaining({
				code: "E09000002",
				type: "localAuthority",
			}),
		);
	});
});
