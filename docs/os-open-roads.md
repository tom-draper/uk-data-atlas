# OS Open Roads overlay

The map streams roads as vector tiles. Do not turn the nationwide OS Open Roads
release into a single GeoJSON asset: it is too large to download and parse in a
browser.

## Provisioning

1. Download the current **Vector Tiles (MBTiles)** release from the [OS Data
   Hub](https://osdatahub.os.uk/downloads/open/OpenRoads). The dataset is free
   under the Open Government Licence.
2. Extract `Data/oproad_gb.mbtiles` to
   `data/transport/os-open-roads/oproad_gb.mbtiles`. The archive and extracted
   database are ignored by Git.
3. Start the local CORS-enabled vector-tile service in one terminal:

   ```sh
   pnpm roads:serve
   ```

   This uses Docker and TileServer GL at `http://localhost:8080`. The supplied
   MBTiles use the `road_link` source layer and provide road tiles from zoom 9
   through 14.
4. Put the resulting values in local `.env` (already configured for the local
   server) and restart `pnpm dev` after changing them:

   ```dotenv
   NEXT_PUBLIC_OS_OPEN_ROADS_TILE_URL=http://localhost:8080/data/oproad_gb/{z}/{x}/{y}.pbf
   NEXT_PUBLIC_OS_OPEN_ROADS_SOURCE_LAYER=road_link
   ```

For production, host the MBTiles (or an equivalent PMTiles/vector-tile
conversion) behind a public CORS-enabled tile service and replace the local URL
with its URL template. Do not deploy the local Docker setup as the production
tile host.

**OS Open Roads** is a first-class Transport dataset. Its chart card selects
the network on the map; until the tile URL is configured, the card clearly
shows that hosting still needs to be set up. The map uses the supplied
`road_classification` attribute for styling: motorways are blue, A roads red,
B roads amber, and the remaining local and unclassified roads grey.

## Attribution and scope

The application renders the required OS attribution. OS Open Roads is a
generalised Great Britain road network intended for approximately 1:15,000 to
1:30,000 viewing. It is appropriate for an overview overlay, not turn-by-turn
routing or road-maintenance responsibility. See the [OS product
documentation](https://docs.os.uk/os-downloads/products/transport-network-portfolio/os-open-roads)
and [technical specification](https://docs.os.uk/os-downloads/products/transport-network-portfolio/os-open-roads/os-open-roads-technical-specification).
