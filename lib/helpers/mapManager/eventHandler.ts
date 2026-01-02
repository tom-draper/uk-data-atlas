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
	private mouseMoveHandler:
		| ((e: MapMouseEventType & { features?: any[] }) => void)
		| null = null;
	private mouseLeaveHandler: (() => void) | null = null;
	private currentData: Record<string, any> | null = null;
	private currentCodeProp: string = "";
	private currentNameProp: string = "";
	private currentBoundaryType: BoundaryType = "ward";
	private canvas: HTMLCanvasElement;

	constructor(
		private map: mapboxgl.Map | maplibregl.Map,
		private callbacks: MapManagerCallbacks
	) {
		this.canvas = this.map.getCanvas();
	}

	setupEventHandlers(data: any, codeProp: string): void {
		this.currentData = data;
		this.currentCodeProp = codeProp;
		this.currentNameProp = this.nameProp(codeProp);
		this.currentBoundaryType = this.boundaryType(codeProp);

		this.removeHandlers();
		this.createHandlers();

		this.map.on("mousemove", FILL_LAYER_ID, this.mouseMoveHandler!);
		this.map.on("mouseleave", FILL_LAYER_ID, this.mouseLeaveHandler!);
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

	private createHandlers(): void {
		this.mouseMoveHandler = throttle((e: MapMouseEventType & { features?: any[] }) => {
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
		}, 10);

		this.mouseLeaveHandler = () => {
			if (this.lastHoveredFeatureId !== null) {
				this.map.setFeatureState(
					{ source: SOURCE_ID, id: this.lastHoveredFeatureId },
					{ hover: false }
				);
				this.lastHoveredFeatureId = null;
			}
			this.canvas.style.cursor = "";
			this.callbacks.onAreaHover?.(null);
		};
	}

	private removeHandlers(): void {
		if (this.mouseMoveHandler) {
			this.map.off("mousemove", FILL_LAYER_ID, this.mouseMoveHandler);
		}
		if (this.mouseLeaveHandler) {
			this.map.off("mouseleave", FILL_LAYER_ID, this.mouseLeaveHandler);
		}
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
		this.mouseMoveHandler = null;
		this.mouseLeaveHandler = null;
		this.currentData = null;
	}
}