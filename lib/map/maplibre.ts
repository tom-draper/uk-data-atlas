import { addProtocol } from "maplibre-gl";
import { pmtilesProtocol } from "./pmtilesProtocol";

addProtocol("pmtiles", pmtilesProtocol.tile);

export { Map, Popup } from "maplibre-gl";
