import type { MapMouseEvent } from "maplibre-gl";
import type { MapInstance } from "@/lib/types/mapInstance";

import { MapManagerCallbacks, type MapLayerMouseHandler } from "./callbacks";
import { BoundaryType, ElectionData } from "@/lib/types";
import {
	boundaryTypeForCodeKey,
	boundaryYearForCodeKey,
	nameKeyForCodeKey,
} from "@/lib/data/boundaries/catalog";
import { OUTSIDE_DATASET_STATE, type BoundaryLayerIds } from "./boundaryLayers";

const DEFAULT_IDS: BoundaryLayerIds = {
	source: "location-wards",
	fill: "wards-fill",
	line: "wards-line",
};

type MapMouseEventType = MapMouseEvent;

type MapFeature = {
	id?: string | number;
	properties?: Record<string, string | undefined>;
	state?: Record<string, unknown>;
};

/**
 * The area under the pointer, unless it is one the boundary layer is keeping
 * hidden because the drawn dataset leaves it out.
 */
const shownFeature = (features?: MapFeature[]): MapFeature | undefined =>
	features?.find(
		(feature) => feature.state?.[OUTSIDE_DATASET_STATE] !== true,
	);

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
	/** The fill layer the handlers are bound to, while they are. */
	private boundFill: string | null = null;
	/** The source holding the feature last marked as hovered. */
	private hoveredSource: string | null = null;

	constructor(
		private map: MapInstance,
		private callbacks: MapManagerCallbacks,
		/** The boundary layers drawn now, which change with the release. */
		private layerIds: () => BoundaryLayerIds = () => DEFAULT_IDS,
	) {
		this.canvas = this.map.getCanvas();
		const { handler, cancel } = rafThrottle(
			this.handleMouseMove.bind(this),
		);
		// MapLibre deletes `features` from the event once the listener returns,
		// so a call the throttle defers would see none and read as a leave.
		this._mouseMoveHandler = (e) => handler(e.features);
		this._cancelMouseMove = cancel;
		this._mouseLeaveHandler = this.handleMouseLeave.bind(this);
		this._clickHandler = this.handleAreaClick.bind(this);
	}

	setupEventHandlers(data: Record<string, unknown>, codeProp: string): void {
		const fill = this.layerIds().fill;
		const handlersAreCurrent =
			this.boundFill === fill &&
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
			fill,
			this._mouseMoveHandler as MapLayerMouseHandler,
		);
		this.map.on("mouseleave", fill, this._mouseLeaveHandler);
		this.map.on("click", fill, this._clickHandler as MapLayerMouseHandler);
		this.boundFill = fill;
	}

	// The catalogue pairs each code property with its name property and
	// geography, so neither has to be guessed from the key's spelling.
	nameProp(codeProp: string) {
		return nameKeyForCodeKey(codeProp) ?? codeProp.replace(/cd$/i, "NM");
	}

	boundaryType(codeProp: string): BoundaryType {
		return boundaryTypeForCodeKey(codeProp) ?? "ward";
	}

	private handleMouseMove(features?: MapFeature[]): void {
		if (this.lockedArea) {
			this.canvas.style.cursor = "";
			return;
		}
		const feature = shownFeature(features);
		if (!feature) {
			if (this.lastHoveredFeatureId !== null) this.handleMouseLeave();
			return;
		}
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
		const code =
			feature.properties?.[this.currentCodeProp] ??
			feature.properties?.code;
		if (!code || !this.currentData) return null;
		const name =
			feature.properties?.[this.currentNameProp] ??
			feature.properties?.name;
		// Type assertion needed: TypeScript can't narrow the discriminated
		// SelectedArea union from a string variable at runtime.
		const boundaryYear = boundaryYearForCodeKey(this.currentCodeProp);
		return {
			type: this.currentBoundaryType,
			code,
			name,
			data: (this.currentData[code] ?? null) as ElectionData | null,
			...(boundaryYear === undefined ? {} : { boundaryYear }),
		} as Parameters<NonNullable<MapManagerCallbacks["onAreaClick"]>>[0];
	}

	private handleAreaClick(
		e: MapMouseEventType & { features?: MapFeature[] },
	): void {
		const feature = shownFeature(e.features);
		if (!feature) return;
		const area = this.areaForFeature(feature);
		if (!area) return;

		if (this.lockedArea) {
			if (
				this.lockedArea.type === area.type &&
				this.lockedArea.code === area.code
			) {
				this.lockedArea = null;
				this.callbacks.onAreaClick?.(area);
				return;
			}
			this.lockedArea = area;
			if (feature.id !== undefined) this.setHoveredFeature(feature.id);
			this.callbacks.onAreaClick?.(area);
			return;
		}

		this.lockedArea = area;
		if (feature.id !== undefined) this.setHoveredFeature(feature.id);
		this.callbacks.onAreaClick?.(area);
	}

	private feature(source: string, id: string | number) {
		return this.map.getSource(source)?.type === "vector"
			? { source, sourceLayer: "boundaries", id }
			: { source, id };
	}

	/**
	 * Clears the hover mark, on the source that holds it: the release may
	 * have changed since, and its source with it.
	 */
	private unhover(): void {
		const source = this.hoveredSource;
		const id = this.lastHoveredFeatureId;
		this.lastHoveredFeatureId = null;
		this.hoveredSource = null;
		if (source === null || id === null || !this.map.getSource(source))
			return;
		this.map.setFeatureState(this.feature(source, id), { hover: false });
	}

	private setHoveredFeature(featureId: string | number): void {
		const source = this.layerIds().source;
		if (!this.map.getSource(source)) return;
		this.unhover();
		this.map.setFeatureState(this.feature(source, featureId), {
			hover: true,
		});
		this.lastHoveredFeatureId = featureId;
		this.hoveredSource = source;
	}

	private handleMouseLeave(): void {
		if (this.lockedArea) {
			this.canvas.style.cursor = "";
			return;
		}
		this.unhover();
		this.canvas.style.cursor = "";
		this.callbacks.onAreaHover?.(null);
	}

	private removeHandlers(): void {
		const fill = this.boundFill;
		if (fill === null) return;
		// Use the bound handlers for off
		this.map.off(
			"mousemove",
			fill,
			this._mouseMoveHandler as MapLayerMouseHandler,
		);
		this.map.off("mouseleave", fill, this._mouseLeaveHandler);
		this.map.off("click", fill, this._clickHandler as MapLayerMouseHandler);
		this.boundFill = null;
	}

	clearAreaLock(): void {
		this.lockedArea = null;
		this.handleMouseLeave();
	}

	destroy(): void {
		this._cancelMouseMove();
		this.removeHandlers();
		try {
			this.unhover();
		} catch {}
		this._mouseMoveHandler = () => {};
		this._mouseLeaveHandler = () => {};
		this._clickHandler = () => {};
		this.currentData = null;
		this.lockedArea = null;
	}
}
