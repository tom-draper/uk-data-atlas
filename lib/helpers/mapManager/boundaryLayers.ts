import { pmtilesURL } from "@/lib/map/tilesUrl";
import { getFeatureProp } from "@uk-data-atlas/datasets";
import type { BoundaryTiles } from "@/lib/data/boundaries/tiles";
import type { GeoJSONSource } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { BoundaryGeojson, Feature } from "@uk-data-atlas/datasets";
import type { MapOptions } from "@/lib/types/mapOptions";
import type { MapInstance } from "@/lib/types/mapInstance";
import { DEFAULT_COLOR } from "./featureBuilder";
import {
	boolean,
	featureState,
	readFromFeatureState,
	when,
	type FillPaintConfig,
	type PaintValue,
} from "./expressions";

export type BoundaryLayerIds = {
	source: string;
	fill: string;
	line: string;
};

/**
 * Two sets of ids, so a new boundary release can load under one while the
 * old release stays drawn under the other.
 */
const LAYER_IDS: readonly [BoundaryLayerIds, BoundaryLayerIds] = [
	{ source: "location-wards", fill: "wards-fill", line: "wards-line" },
	{
		source: "location-wards-next",
		fill: "wards-fill-next",
		line: "wards-line-next",
	},
];

/** Longest an old release stays drawn while the new one's tiles load. */
const RETIRE_AFTER_MS = 5000;
/**
 * Feature state marking an area the source still holds but the dataset being
 * drawn leaves out. Exported so hover and click can ignore those areas too.
 */
export const OUTSIDE_DATASET_STATE = "outsideDataset";
const BORDER_OPACITY = 0.05;

const emptyFeatureCollection = (): FeatureCollection => ({
	type: "FeatureCollection",
	features: [],
});

const asMapData = (geojson: BoundaryGeojson) =>
	geojson as unknown as GeoJSON.FeatureCollection;

/**
 * Whether the style itself has loaded, whatever its sources are doing.
 *
 * `isStyleLoaded()` is also false while any source still has tiles to parse, so
 * gating on it made a dataset picked while the previous one was still tiling
 * wait for that work, and the map to go idle, before it could start its own.
 * Sources and paint can be updated as soon as the style is in place. Both map
 * providers keep that flag on `style._loaded`; fall back to the public check if
 * one ever stops doing so.
 */
const styleIsReady = (map: MapInstance): boolean => {
	const loaded = (map as { style?: { _loaded?: unknown } }).style?._loaded;
	return typeof loaded === "boolean" ? loaded : map.isStyleLoaded() === true;
};

/**
 * Each feature's geometry by id, when every feature carries geometry and a
 * distinct id, which is what feature state needs to address it. Null otherwise,
 * and then the source is redrawn from its properties alone.
 */
const geometryById = (
	geojson: BoundaryGeojson,
): Map<number, NonNullable<Feature["geometry"]>> | null => {
	if (geojson.features.length === 0) return null;
	const geometries = new Map<number, NonNullable<Feature["geometry"]>>();
	for (const feature of geojson.features) {
		if (
			!feature.geometry ||
			!Number.isSafeInteger(feature.id) ||
			geometries.has(feature.id)
		)
			return null;
		geometries.set(feature.id, feature.geometry);
	}
	return geometries;
};

/**
 * Draws the active dataset over its boundaries.
 *
 * Re-uploading a collection makes MapLibre serialise it on the main thread and
 * re-tile it in a worker, which takes seconds for a national ward map. Most
 * dataset changes keep the same boundary file, though: the collection is new
 * only because its features carry new values. So while the source already
 * holds every feature being drawn, by the same geometry object, the values the
 * fill reads are set as feature state instead, and any feature the dataset
 * leaves out is hidden rather than removed.
 */
export class BoundaryLayerController {
	private tiles: BoundaryTiles | null = null;
	private slot: 0 | 1 = 0;
	/** The ids of the release drawn now, which hover and click follow. */
	get ids(): BoundaryLayerIds {
		return LAYER_IDS[this.slot];
	}
	/**
	 * The previous release, kept drawn above the new one until the new one's
	 * tiles have loaded, so a change of release never shows a bare basemap.
	 */
	private retiring: {
		ids: BoundaryLayerIds;
		drop: () => void;
		watched: boolean;
	} | null = null;
	private sourceTiles: BoundaryTiles | null = null;

	setTiles(tiles: BoundaryTiles | null): void {
		this.tiles = tiles;
	}

	private lastFillPaint: FillPaintConfig | null = null;
	/** The uploaded features' geometry, when they can be addressed by state. */
	private sourceGeometry: Map<
		number,
		NonNullable<Feature["geometry"]>
	> | null = null;
	/** The collection whose values are drawn, uploaded or not. */
	private drawnGeojson: BoundaryGeojson | null = null;
	/** Which of the drawn collection's properties are set as state. */
	private stateProperties: string | null = null;
	/**
	 * The state last set on each feature of the source, so a new collection
	 * only writes the features whose values changed.
	 */
	private featureStates = new Map<number, Record<string, unknown>>();
	private hidesFeatures = false;
	private deferredPaint: {
		geojson: BoundaryGeojson;
		paint: FillPaintConfig;
		visibility: MapOptions["visibility"];
	} | null = null;
	private awaitingStyle = false;

	constructor(private readonly map: MapInstance) {}

	paint(
		geojson: BoundaryGeojson,
		paint: FillPaintConfig,
		visibility: MapOptions["visibility"],
	): void {
		this.lastFillPaint = paint;
		if (!styleIsReady(this.map)) {
			this.deferredPaint = { geojson, paint, visibility };
			if (!this.awaitingStyle) {
				this.awaitingStyle = true;
				this.map.once("idle", () => {
					this.awaitingStyle = false;
					const deferred = this.deferredPaint;
					this.deferredPaint = null;
					if (deferred)
						this.paint(
							deferred.geojson,
							deferred.paint,
							deferred.visibility,
						);
				});
			}
			return;
		}
		this.deferredPaint = null;

		if (this.sourceTiles?.href !== this.tiles?.href) {
			if (
				this.sourceTiles &&
				this.tiles &&
				this.map.getLayer(this.ids.fill) &&
				this.map.getLayer(this.ids.line)
			)
				this.retireLayers();
			else {
				this.retiring?.drop();
				this.removeExistingLayers();
			}
		}

		const sourceExists = !!this.map.getSource(this.ids.source);
		const fillLayerExists = !!this.map.getLayer(this.ids.fill);
		const lineLayerExists = !!this.map.getLayer(this.ids.line);
		if (sourceExists && fillLayerExists && lineLayerExists) {
			if (this.drawnGeojson !== geojson) {
				if (!this.tiles && !this.sourceHolds(geojson)) {
					(
						this.map.getSource(this.ids.source) as GeoJSONSource
					).setData(asMapData(geojson));
					this.uploaded(geojson);
				}
				this.drawnGeojson = geojson;
				this.stateProperties = null;
			}
			this.applyVisibility(visibility);
			return;
		}

		this.removeExistingLayers();
		this.addSource(geojson);
		// Under the release being retired, which is removed once this one has
		// loaded, so the switch shows no gap.
		const below = this.retiring?.ids.fill;
		if (this.retiring) this.awaitRetirement(this.ids.source);
		this.uploaded(geojson);
		this.drawnGeojson = geojson;
		this.map.addLayer(
			{
				id: this.ids.fill,
				type: "fill",
				source: this.ids.source,
				...(this.tiles ? { "source-layer": "boundaries" } : {}),
				paint: { "fill-color": DEFAULT_COLOR, "fill-opacity": 0 },
			},
			below,
		);
		this.map.addLayer(
			{
				id: this.ids.line,
				type: "line",
				source: this.ids.source,
				...(this.tiles ? { "source-layer": "boundaries" } : {}),
				paint: {
					"line-color": "#000",
					"line-width": 1,
					"line-opacity": 0,
				},
			},
			below,
		);
		this.applyVisibility(visibility);
	}

	updateVisibility(visibility: MapOptions["visibility"]): void {
		if (!styleIsReady(this.map) || !this.lastFillPaint) return;
		this.applyVisibility(visibility);
	}

	clear(): void {
		this.retiring?.drop();
		if (this.sourceTiles) {
			this.removeExistingLayers();
			return;
		}
		this.forgetSource();
		const source = this.map.getSource(this.ids.source) as
			GeoJSONSource | undefined;
		if (source) source.setData(emptyFeatureCollection());
	}

	setBorderVisibility(hidden: boolean): void {
		if (!styleIsReady(this.map)) return;
		if (this.map.getLayer(this.ids.line)) {
			this.map.setPaintProperty(
				this.ids.line,
				"line-opacity",
				hidden ? 0 : this.shownOnly(BORDER_OPACITY),
			);
		}
		for (const layerId of BASE_BOUNDARY_LAYERS) {
			if (this.map.getLayer(layerId))
				this.map.setPaintProperty(
					layerId,
					"line-opacity",
					hidden ? 0 : 1,
				);
		}
	}

	private applyVisibility(visibility: MapOptions["visibility"]): void {
		if (!this.lastFillPaint) return;
		if (
			!this.map.getLayer(this.ids.fill) ||
			!this.map.getLayer(this.ids.line)
		)
			return;

		// Brings the state up to date even while the data layer is hidden, as
		// it also decides which features are shown at all.
		const dataColor = this.colorFromState(this.lastFillPaint.color);
		const overlayOpacity = visibility.overlayOpacity ?? 0.6;
		const hidden = visibility.hideBoundaryLayer;
		const fillColor = hidden
			? "transparent"
			: visibility.hideDataLayer
				? DEFAULT_COLOR
				: dataColor;
		const fillOpacity = hidden
			? 0
			: this.shownOnly(
					visibility.hideDataLayer
						? overlayOpacity
						: this.lastFillPaint.opacity(overlayOpacity),
				);

		this.map.setPaintProperty(this.ids.fill, "fill-color", fillColor);
		this.map.setPaintProperty(this.ids.fill, "fill-opacity", fillOpacity);
		this.map.setPaintProperty(
			this.ids.line,
			"line-color",
			hidden ? "transparent" : "#000",
		);
		this.map.setPaintProperty(
			this.ids.line,
			"line-opacity",
			hidden || visibility.hideBorders
				? 0
				: this.shownOnly(BORDER_OPACITY),
		);
	}

	/** Whether the source already holds every feature, geometry and all. */
	private sourceHolds(geojson: BoundaryGeojson): boolean {
		const geometry = this.sourceGeometry;
		return (
			geometry !== null &&
			geojson.features.length > 0 &&
			geojson.features.every(
				(feature) =>
					feature.geometry !== null &&
					geometry.get(feature.id) === feature.geometry,
			)
		);
	}

	private uploaded(geojson: BoundaryGeojson): void {
		this.sourceGeometry = geometryById(geojson);
		this.hidesFeatures = false;
	}

	private forgetSource(): void {
		this.sourceTiles = null;
		this.sourceGeometry = null;
		this.drawnGeojson = null;
		this.stateProperties = null;
		this.featureStates.clear();
		this.hidesFeatures = false;
	}

	/**
	 * The fill colour, reading its values from feature state when the source is
	 * addressed that way, with that state brought up to date first.
	 */
	private colorFromState(color: PaintValue<string>): PaintValue<string> {
		if (!this.sourceGeometry && !this.tiles) return color;
		const { value, properties } = readFromFeatureState(color);
		this.setState(properties);
		return value;
	}

	/**
	 * Sets the drawn features' values as state, and hides the features the
	 * source holds that the drawn collection leaves out.
	 */
	private setState(properties: string[]): void {
		const geometry = this.sourceGeometry;
		const drawn = this.drawnGeojson;
		const key = properties.join("\u0000");
		if (
			(!geometry && !this.tiles) ||
			!drawn ||
			this.stateProperties === key
		)
			return;
		this.stateProperties = key;
		const shown = new Set<number>();
		for (const feature of drawn.features) {
			const code =
				this.tiles &&
				getFeatureProp(feature.properties, this.tiles.codeKey);
			const id = this.tiles
				? typeof code === "string"
					? this.tiles.ids.get(code)
					: undefined
				: feature.id;
			if (id === undefined) continue;
			shown.add(id);
			const values = feature.properties as unknown as Record<
				string,
				unknown
			>;
			const state: Record<string, unknown> = {
				[OUTSIDE_DATASET_STATE]: false,
			};
			for (const property of properties)
				state[property] = values[property] ?? null;
			this.writeState(id, state);
		}
		this.hidesFeatures = !!this.tiles || shown.size < (geometry?.size ?? 0);
		if (this.tiles) {
			for (const id of this.tiles.ids.values())
				if (!shown.has(id))
					this.writeState(id, { [OUTSIDE_DATASET_STATE]: true });
			return;
		}
		if (!this.hidesFeatures) return;
		for (const id of geometry?.keys() ?? [])
			if (!shown.has(id))
				this.writeState(id, { [OUTSIDE_DATASET_STATE]: true });
	}

	/** Sets a feature's state, unless it already holds these values. */
	private writeState(id: number, state: Record<string, unknown>): void {
		const known = this.featureStates.get(id);
		if (
			known &&
			Object.keys(state).every((key) => known[key] === state[key])
		)
			return;
		this.featureStates.set(id, { ...known, ...state });
		this.map.setFeatureState(
			{
				source: this.ids.source,
				id,
				...(this.tiles ? { sourceLayer: "boundaries" } : {}),
			},
			state,
		);
	}

	/** An opacity that leaves the features outside the dataset invisible. */
	private shownOnly(opacity: PaintValue<number>): PaintValue<number> {
		if (!this.hidesFeatures) return opacity;
		return when(
			[[boolean(featureState(OUTSIDE_DATASET_STATE), false), 0]],
			opacity,
		) as PaintValue<number>;
	}

	/**
	 * Keeps the drawn release on screen and moves to the other ids, where the
	 * new release is added. Any release still being retired goes now.
	 */
	private retireLayers(): void {
		this.retiring?.drop();
		const ids = this.ids;
		const drop = () => {
			if (this.retiring?.ids !== ids) return;
			this.retiring = null;
			this.removeLayers(ids);
		};
		this.retiring = { ids, drop, watched: false };
		this.forgetSource();
		this.slot = this.slot === 0 ? 1 : 0;
	}

	/** Drops the retiring release once `source` has loaded its tiles. */
	private awaitRetirement(source: string): void {
		const retiring = this.retiring;
		if (!retiring || retiring.watched) return;
		retiring.watched = true;
		const onData = (event: { sourceId?: string; tile?: unknown }) => {
			// Every tile in view has loaded. Checked on tile events only, since
			// a source with no tiles requested yet also counts as loaded.
			if (
				event.sourceId === source &&
				event.tile &&
				this.map.isSourceLoaded(source)
			)
				retiring.drop();
		};
		const timer = setTimeout(() => retiring.drop(), RETIRE_AFTER_MS);
		const drop = retiring.drop;
		retiring.drop = () => {
			this.map.off("sourcedata", onData);
			clearTimeout(timer);
			drop();
		};
		this.map.on("sourcedata", onData);
	}

	private removeLayers(ids: BoundaryLayerIds): void {
		if (this.map.getLayer(ids.fill)) this.map.removeLayer(ids.fill);
		if (this.map.getLayer(ids.line)) this.map.removeLayer(ids.line);
		if (this.map.getSource(ids.source)) this.map.removeSource(ids.source);
	}

	private removeExistingLayers(): void {
		this.forgetSource();
		if (!this.map.getSource(this.ids.source)) return;
		if (this.map.getLayer(this.ids.fill))
			this.map.removeLayer(this.ids.fill);
		if (this.map.getLayer(this.ids.line))
			this.map.removeLayer(this.ids.line);
		this.map.removeSource(this.ids.source);
	}

	private addSource(geojson: BoundaryGeojson): void {
		if (this.tiles) {
			this.sourceTiles = this.tiles;
			this.map.addSource(this.ids.source, {
				type: "vector",
				url: pmtilesURL(this.tiles.href, window.location.href),
				minzoom: this.tiles.minZoom,
				maxzoom: this.tiles.maxZoom,
			});
			return;
		}
		this.map.addSource(this.ids.source, {
			type: "geojson",
			data: asMapData(geojson),
		});
	}
}

const BASE_BOUNDARY_LAYERS = [
	"boundary_county",
	"boundary_state",
	"boundary_country_outline",
	"boundary_country_inner",
];
