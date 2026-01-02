import type { MapMouseEvent } from "mapbox-gl";
import type { MapLibreEvent } from "maplibre-gl";
import { MapManagerCallbacks } from "./mapManager";
import { BoundaryType } from "@/lib/types";

const SOURCE_ID = "location-wards";
const FILL_LAYER_ID = "wards-fill";

type MapMouseEventType = MapMouseEvent | MapLibreEvent;

function throttle<T extends (...args: any[]) => void>(
	func: T,
	limit: number
): (...args: Parameters<T>) => void {
	let inThrottle: boolean;
	return function (this: any, ...args: Parameters<T>): void {
		if (!inThrottle) {
			func.apply(this, args);
			inThrottle = true;
			setTimeout(() => (inThrottle = false), limit);
		}
	};
}

export class EventHandler {
	private lastHoveredFeatureId: string | number | null = null;
	private currentData: Record<string, any> | null = null;
	private currentCodeProp: string = "";
	private currentNameProp: string = "";
	private currentBoundaryType: BoundaryType = "ward";
	private canvas: HTMLCanvasElement;
	private _mouseMoveHandler: (e: MapMouseEventType & { features?: any[] }) => void;
	private _mouseLeaveHandler: () => void;

	constructor(
		private map: mapboxgl.Map | maplibregl.Map,
		private callbacks: MapManagerCallbacks
	) {
		this.canvas = this.map.getCanvas();
		this._mouseMoveHandler = throttle(this.handleMouseMove.bind(this), 10);
		this._mouseLeaveHandler = this.handleMouseLeave.bind(this);
	}

	setupEventHandlers(data: any, codeProp: string): void {
		this.currentData = data;
		this.currentCodeProp = codeProp;
		this.currentNameProp = this.nameProp(codeProp);
		this.currentBoundaryType = this.boundaryType(codeProp);

		this.removeHandlers();

		(this.map as any).on("mousemove", FILL_LAYER_ID, this._mouseMoveHandler);
		(this.map as any).on("mouseleave", FILL_LAYER_ID, this._mouseLeaveHandler);
	}

	nameProp(codeProp: string) {
		return codeProp.replace("CD", "NM");
	}

	boundaryType(codeProp: string) {
		if (codeProp.toUpperCase().startsWith('LAD')) return "localAuthority";
		if (codeProp.toUpperCase().startsWith('WD')) return "ward";
		if (codeProp.toUpperCase().startsWith('PCON')) return "constituency";
		return "ward"; // default
	}

	private handleMouseMove(e: MapMouseEventType & { features?: any[] }): void {
		const features = e.features;
		if (!features?.length) return;

		const feature = features[0];
		const featureId = feature.id;

		// Early return if hovering same feature
		if (featureId === undefined || featureId === this.lastHoveredFeatureId) return;

		// Set cursor immediately for instant feedback
		this.canvas.style.cursor = "pointer";

		// Trigger callback immediately (perceived performance boost)
		const code = feature.properties?.[this.currentCodeProp];
		if (code && this.currentData) {
			const name = feature.properties?.[this.currentNameProp];
			this.callbacks.onAreaHover?.({
				type: this.currentBoundaryType,
				code,
				name,
				data: this.currentData[code] ?? null,
			});
		}

		// Then update feature states
		if (this.lastHoveredFeatureId !== null) {
			this.map.setFeatureState(
				{ source: SOURCE_ID, id: this.lastHoveredFeatureId },
				{ hover: false }
			);
		}
		this.map.setFeatureState(
			{ source: SOURCE_ID, id: featureId },
			{ hover: true }
		);
		this.lastHoveredFeatureId = featureId;
	}

	private handleMouseLeave(): void {
		if (this.lastHoveredFeatureId !== null) {
			this.map.setFeatureState(
				{ source: SOURCE_ID, id: this.lastHoveredFeatureId },
				{ hover: false }
			);
			this.lastHoveredFeatureId = null;
		}
		this.canvas.style.cursor = "";
		this.callbacks.onAreaHover?.(null);
	}

	private removeHandlers(): void {
		// Use the bound handlers for off
		(this.map as any).off("mousemove", FILL_LAYER_ID, this._mouseMoveHandler);
		(this.map as any).off("mouseleave", FILL_LAYER_ID, this._mouseLeaveHandler);
	}

	destroy(): void {
		this.removeHandlers();
		if (this.lastHoveredFeatureId !== null) {
			try {
				this.map.setFeatureState(
					{ source: SOURCE_ID, id: this.lastHoveredFeatureId },
					{ hover: false }
				);
			} catch { }
			this.lastHoveredFeatureId = null;
		}
		// Clear bound handlers
		this._mouseMoveHandler = (() => { }) as any; // Assign empty function to avoid errors
		this._mouseLeaveHandler = (() => { }) as any; // Assign empty function to avoid errors
		this.currentData = null;
	}
}