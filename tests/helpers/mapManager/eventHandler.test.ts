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
	it("selects a tile by its code and name and addresses its source layer", () => {
		const map = createMap();
		map.getSource.mockReturnValue({ type: "vector" });
		const onAreaClick = vi.fn();
		const handler = new EventHandler(map as any, {
			onAreaClick,
			onLocationChange: () => {},
		});
		handler.setupEventHandlers({ E001: { value: 10 } }, "WD24CD");
		const click = map.on.mock.calls.find(
			([event]) => event === "click",
		)?.[2] as (event: unknown) => void;
		click({
			features: [
				{ id: 12, properties: { code: "E001", name: "Test ward" } },
			],
		});
		expect(onAreaClick).toHaveBeenCalledWith(
			expect.objectContaining({
				code: "E001",
				name: "Test ward",
				type: "ward",
				boundaryYear: 2024,
				data: { value: 10 },
			}),
		);
		expect(map.setFeatureState).toHaveBeenCalledWith(
			{ source: "location-wards", sourceLayer: "boundaries", id: 12 },
			{ hover: true },
		);
	});

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

	it("switches the locked area on click and releases it on a second click", () => {
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

		expect(onAreaClick).toHaveBeenCalledTimes(2);
		expect(onAreaClick).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				code: "E09000001",
				type: "localAuthority",
			}),
		);
		expect(onAreaClick).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				code: "E09000002",
				type: "localAuthority",
			}),
		);
		expect(onAreaHover).not.toHaveBeenCalled();

		click({ features: [feature(2, "E09000002")] });
		(handler as any).handleMouseMove({
			features: [feature(1, "E09000001")],
		});

		expect(onAreaClick).toHaveBeenCalledTimes(3);
		expect(onAreaHover).toHaveBeenCalledWith(
			expect.objectContaining({
				code: "E09000001",
				type: "localAuthority",
			}),
		);
	});

	it("ignores areas the boundary layer is hiding", () => {
		const map = createMap();
		map.getSource.mockReturnValue({});
		const onAreaHover = vi.fn();
		const onAreaClick = vi.fn();
		const handler = new EventHandler(map as any, {
			onAreaHover,
			onAreaClick,
			onLocationChange: () => {},
		});
		handler.setupEventHandlers(
			{ E09000001: { value: 10 }, E09000002: { value: 20 } },
			"LAD24CD",
		);
		const click = map.on.mock.calls.find(
			([event]) => event === "click",
		)?.[2] as (event: unknown) => void;
		const shown = {
			id: 1,
			properties: { LAD24CD: "E09000001", LAD24NM: "Shown" },
			state: { outsideDataset: false },
		};
		const hidden = {
			id: 2,
			properties: { LAD24CD: "E09000002", LAD24NM: "Hidden" },
			state: { outsideDataset: true },
		};

		(handler as any).handleMouseMove({ features: [shown] });
		(handler as any).handleMouseMove({ features: [hidden] });
		click({ features: [hidden] });

		expect(onAreaHover).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ code: "E09000001" }),
		);
		// Moving onto a hidden area leaves the shown one.
		expect(onAreaHover).toHaveBeenLastCalledWith(null);
		expect(onAreaClick).not.toHaveBeenCalled();
	});
});
