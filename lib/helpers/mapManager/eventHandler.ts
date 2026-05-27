import type { MapGeoJSONFeature, MapMouseEvent } from "maplibre-gl";

type MapLayerMouseHandler = (
	ev: MapMouseEvent & { features?: MapGeoJSONFeature[] },
) => void;
import { MapManagerCallbacks } from "./mapManager";
import { BoundaryType, ElectionData } from "@/lib/types";

const SOURCE_ID = "location-wards";
const FILL_LAYER_ID = "wards-fill";

type MapMouseEventType = MapMouseEvent;

type MapFeature = {
	id?: string | number;
	properties?: Record<string, string | undefined>;
};

function throttle<T extends (...args: Parameters<T>) => void>(
	func: T,
	limit: number,
): (...args: Parameters<T>) => void {
	let inThrottle = false;
	return function (...args: Parameters<T>): void {
		if (!inThrottle) {
			func(...args);
			inThrottle = true;
			setTimeout(() => (inThrottle = false), limit);
		}
	};
}

export class EventHandler {
	private lastHoveredFeatureId: string | number | null = null;
	private currentData: Record<string, unknown> | null = null;
	private currentCodeProp: string = "";
	private currentNameProp: string = "";
	private currentBoundaryType: BoundaryType = "ward";
	private canvas: HTMLCanvasElement;
	private _mouseMoveHandler: (
		e: MapMouseEventType & { features?: MapFeature[] },
	) => void;
	private _mouseLeaveHandler: () => void;

	constructor(
		private map: maplibregl.Map,
		private callbacks: MapManagerCallbacks,
	) {
		this.canvas = this.map.getCanvas();
		this._mouseMoveHandler = throttle(this.handleMouseMove.bind(this), 10);
		this._mouseLeaveHandler = this.handleMouseLeave.bind(this);
	}

	setupEventHandlers(data: Record<string, unknown>, codeProp: string): void {
		this.currentData = data;
		this.currentCodeProp = codeProp;
		this.currentNameProp = this.nameProp(codeProp);
		this.currentBoundaryType = this.boundaryType(codeProp);

		this.removeHandlers();

		this.map.on(
			"mousemove",
			FILL_LAYER_ID,
			this._mouseMoveHandler as MapLayerMouseHandler,
		);
		this.map.on("mouseleave", FILL_LAYER_ID, this._mouseLeaveHandler);
	}

	nameProp(codeProp: string) {
		return codeProp.replace("CD", "NM");
	}

	boundaryType(codeProp: string) {
		if (codeProp.toUpperCase().startsWith("LAD")) return "localAuthority";
		if (codeProp.toUpperCase().startsWith("WD")) return "ward";
		if (codeProp.toUpperCase().startsWith("PCON")) return "constituency";
		if (codeProp.toUpperCase().startsWith("LSOA")) return "lsoa";
		return "ward"; // default
	}

	private handleMouseMove(
		e: MapMouseEventType & { features?: MapFeature[] },
	): void {
		const features = e.features;
		if (!features?.length) return;

		const feature = features[0];
		const featureId = feature.id;

		// Early return if hovering same feature
		if (featureId === undefined || featureId === this.lastHoveredFeatureId)
			return;

		// Set cursor immediately for instant feedback
		this.canvas.style.cursor = "pointer";

		// Trigger callback immediately (perceived performance boost)
		const code = feature.properties?.[this.currentCodeProp];
		if (code && this.currentData) {
			const name = feature.properties?.[this.currentNameProp];
			// Type assertion needed: TypeScript can't narrow the discriminated
			// SelectedArea union from a string variable at runtime
			this.callbacks.onAreaHover?.({
				type: this.currentBoundaryType,
				code,
				name,
				data: (this.currentData[code] ?? null) as ElectionData | null,
			} as Parameters<
				NonNullable<MapManagerCallbacks["onAreaHover"]>
			>[0]);
		}

		// Then update feature states
		if (this.lastHoveredFeatureId !== null) {
			this.map.setFeatureState(
				{ source: SOURCE_ID, id: this.lastHoveredFeatureId },
				{ hover: false },
			);
		}
		this.map.setFeatureState(
			{ source: SOURCE_ID, id: featureId },
			{ hover: true },
		);
		this.lastHoveredFeatureId = featureId;
	}

	private handleMouseLeave(): void {
		if (this.lastHoveredFeatureId !== null) {
			this.map.setFeatureState(
				{ source: SOURCE_ID, id: this.lastHoveredFeatureId },
				{ hover: false },
			);
			this.lastHoveredFeatureId = null;
		}
		this.canvas.style.cursor = "";
		this.callbacks.onAreaHover?.(null);
	}

	private removeHandlers(): void {
		// Use the bound handlers for off
		this.map.off(
			"mousemove",
			FILL_LAYER_ID,
			this._mouseMoveHandler as MapLayerMouseHandler,
		);
		this.map.off("mouseleave", FILL_LAYER_ID, this._mouseLeaveHandler);
	}

	destroy(): void {
		this.removeHandlers();
		if (this.lastHoveredFeatureId !== null) {
			try {
				this.map.setFeatureState(
					{ source: SOURCE_ID, id: this.lastHoveredFeatureId },
					{ hover: false },
				);
			} catch {}
			this.lastHoveredFeatureId = null;
		}
		// Clear bound handlers
		this._mouseMoveHandler = () => {};
		this._mouseLeaveHandler = () => {};
		this.currentData = null;
	}
}
