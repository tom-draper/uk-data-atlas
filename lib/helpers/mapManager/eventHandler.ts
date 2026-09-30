import type { MapMouseEvent } from "maplibre-gl";
import type { MapInstance } from "@/lib/types/mapInstance";

import { MapManagerCallbacks, type MapLayerMouseHandler } from "./callbacks";
import { BoundaryType, ElectionData } from "@/lib/types";
import {
	boundaryTypeForCodeKey,
	nameKeyForCodeKey,
} from "@/lib/data/boundaries/catalog";

const SOURCE_ID = "location-wards";
const FILL_LAYER_ID = "wards-fill";

type MapMouseEventType = MapMouseEvent;

type MapFeature = {
	id?: string | number;
	properties?: Record<string, string | undefined>;
};

function rafThrottle<T extends unknown[]>(
	func: (...args: T) => void,
): { handler: (...args: T) => void; cancel: () => void } {
	let rafId: number | null = null;
	let trailingArgs: T | null = null;

	const handler = (...args: T): void => {
		if (rafId === null) {
			// Leading: fire immediately, then open a window for trailing calls
			func(...args);
			rafId = requestAnimationFrame(() => {
				rafId = null;
				if (trailingArgs) {
					func(...trailingArgs);
					trailingArgs = null;
				}
			});
		} else {
			// Within the RAF window: keep only the latest args for the trailing call
			trailingArgs = args;
		}
	};

	const cancel = () => {
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
		trailingArgs = null;
	};

	return { handler, cancel };
}

export class EventHandler {
	private lastHoveredFeatureId: string | number | null = null;
	private currentData: Record<string, unknown> | null = null;
	private currentCodeProp: string = "";
	private currentNameProp: string = "";
	private currentBoundaryType: BoundaryType = "ward";
	private lockedArea:
		Parameters<NonNullable<MapManagerCallbacks["onAreaClick"]>>[0] | null =
		null;
	private canvas: HTMLCanvasElement;
	private _mouseMoveHandler: (
		e: MapMouseEventType & { features?: MapFeature[] },
	) => void;
	private _cancelMouseMove: () => void;
	private _mouseLeaveHandler: () => void;
	private _clickHandler: (
		e: MapMouseEventType & { features?: MapFeature[] },
	) => void;
	private handlersAttached = false;

	constructor(
		private map: MapInstance,
		private callbacks: MapManagerCallbacks,
	) {
		this.canvas = this.map.getCanvas();
		const { handler, cancel } = rafThrottle(
			this.handleMouseMove.bind(this),
		);
		this._mouseMoveHandler = handler;
		this._cancelMouseMove = cancel;
		this._mouseLeaveHandler = this.handleMouseLeave.bind(this);
		this._clickHandler = this.handleAreaClick.bind(this);
	}

	setupEventHandlers(data: Record<string, unknown>, codeProp: string): void {
		const handlersAreCurrent =
			this.handlersAttached &&
			this.currentData === data &&
			this.currentCodeProp === codeProp;
		this.currentData = data;
		this.currentCodeProp = codeProp;
		this.currentNameProp = this.nameProp(codeProp);
		this.currentBoundaryType = this.boundaryType(codeProp);
		if (handlersAreCurrent) return;

		this.removeHandlers();

		this.map.on(
			"mousemove",
			FILL_LAYER_ID,
			this._mouseMoveHandler as MapLayerMouseHandler,
		);
		this.map.on("mouseleave", FILL_LAYER_ID, this._mouseLeaveHandler);
		this.map.on(
			"click",
			FILL_LAYER_ID,
			this._clickHandler as MapLayerMouseHandler,
		);
		this.handlersAttached = true;
	}

	// The catalogue pairs each code property with its name property and
	// geography, so neither has to be guessed from the key's spelling.
	nameProp(codeProp: string) {
		return nameKeyForCodeKey(codeProp) ?? codeProp.replace(/cd$/i, "NM");
	}

	boundaryType(codeProp: string): BoundaryType {
		return boundaryTypeForCodeKey(codeProp) ?? "ward";
	}

	private handleMouseMove(
		e: MapMouseEventType & { features?: MapFeature[] },
	): void {
		if (this.lockedArea) {
			this.canvas.style.cursor = "";
			return;
		}
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
		const area = this.areaForFeature(feature);
		if (area) this.callbacks.onAreaHover?.(area);

		this.setHoveredFeature(featureId);
	}

	private areaForFeature(feature: MapFeature) {
		const code = feature.properties?.[this.currentCodeProp];
		if (!code || !this.currentData) return null;
		const name = feature.properties?.[this.currentNameProp];
		// Type assertion needed: TypeScript can't narrow the discriminated
		// SelectedArea union from a string variable at runtime.
		return {
			type: this.currentBoundaryType,
			code,
			name,
			data: (this.currentData[code] ?? null) as ElectionData | null,
		} as Parameters<NonNullable<MapManagerCallbacks["onAreaClick"]>>[0];
	}

	private handleAreaClick(
		e: MapMouseEventType & { features?: MapFeature[] },
	): void {
		const feature = e.features?.[0];
		if (!feature) return;
		const area = this.areaForFeature(feature);
		if (!area) return;

		if (this.lockedArea) {
			if (
				this.lockedArea.type !== area.type ||
				this.lockedArea.code !== area.code
			)
				return;
			this.lockedArea = null;
			this.callbacks.onAreaClick?.(area);
			return;
		}

		this.lockedArea = area;
		if (feature.id !== undefined) this.setHoveredFeature(feature.id);
		this.callbacks.onAreaClick?.(area);
	}

	private setHoveredFeature(featureId: string | number): void {
		if (!this.map.getSource(SOURCE_ID)) return;
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
		if (this.lockedArea) {
			this.canvas.style.cursor = "";
			return;
		}
		if (this.lastHoveredFeatureId !== null) {
			if (this.map.getSource(SOURCE_ID)) {
				this.map.setFeatureState(
					{ source: SOURCE_ID, id: this.lastHoveredFeatureId },
					{ hover: false },
				);
			}
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
		this.map.off(
			"click",
			FILL_LAYER_ID,
			this._clickHandler as MapLayerMouseHandler,
		);
		this.handlersAttached = false;
	}

	clearAreaLock(): void {
		this.lockedArea = null;
		this.handleMouseLeave();
	}

	destroy(): void {
		this._cancelMouseMove();
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
		this._mouseMoveHandler = () => {};
		this._mouseLeaveHandler = () => {};
		this._clickHandler = () => {};
		this.currentData = null;
		this.lockedArea = null;
	}
}
