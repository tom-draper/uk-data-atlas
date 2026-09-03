# OS Open Roads overlay

The map streams roads as vector tiles. Do not turn the nationwide OS Open Roads
release into a single GeoJSON asset: it is too large to download and parse in a
browser.

## Provisioning

1. Download the current **Vector Tiles (MBTiles)** release from the [OS Data
   Hub](https://osdatahub.os.uk/downloads/open/OpenRoads). The dataset is free
   under the Open Government Licence.
2. Serve the MBTiles archive, or an equivalent converted tile archive, through
   a CORS-enabled vector-tile service. It must expose a URL template in the
   form `https://tiles.example.com/os-open-roads/{z}/{x}/{y}.pbf`.
3. Inspect the tile metadata and set the RoadLink source-layer name if the
   service changes it. The supplied archive uses `RoadLink`.
4. Put the resulting values in the deployment environment (or local `.env`):

   ```dotenv
   NEXT_PUBLIC_OS_OPEN_ROADS_TILE_URL=https://tiles.example.com/os-open-roads/{z}/{x}/{y}.pbf
   NEXT_PUBLIC_OS_OPEN_ROADS_SOURCE_LAYER=RoadLink
   ```

**OS Open Roads** is a first-class Transport dataset. Its chart card selects
the network on the map; until the tile URL is configured, the card clearly
shows that hosting still needs to be set up.

## Attribution and scope

The application renders the required OS attribution. OS Open Roads is a
generalised Great Britain road network intended for approximately 1:15,000 to
1:30,000 viewing. It is appropriate for an overview overlay, not turn-by-turn
routing or road-maintenance responsibility. See the [OS product
documentation](https://docs.os.uk/os-downloads/products/transport-network-portfolio/os-open-roads)
and [technical specification](https://docs.os.uk/os-downloads/products/transport-network-portfolio/os-open-roads/os-open-roads-technical-specification).
