from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.map_resource_topology import MapResourceTopology

if TYPE_CHECKING:
    from ..models.map_resource_attribution import MapResourceAttribution
    from ..models.map_resource_features_item import MapResourceFeaturesItem
    from ..models.map_resource_generalisation import MapResourceGeneralisation
    from ..models.map_resource_geometry_source import MapResourceGeometrySource
    from ..models.map_resource_tiers_item import MapResourceTiersItem
    from ..models.map_resource_tiles import MapResourceTiles


T = TypeVar("T", bound="MapResource")


@_attrs_define
class MapResource:
    """
    Attributes:
        arc_count (int): Distinct boundary arcs the release decomposes into.
        area_count (int):
        attribution (MapResourceAttribution):
        boundary_release (str):
        bounds (list[float]): West, south, east and north, in degrees.
        features (list[MapResourceFeaturesItem]): Every tier as a whole-release download in GeoParquet, and the `medium`
            and `low` tiers in GeoJSON too, compiled from the same shared-arc generalisation as the tiles.
        generalisation (MapResourceGeneralisation): The terms the tiers were compiled on, in plain words.
        geography (str):
        geometry_source (MapResourceGeometrySource): The publisher file behind the shapes, and how it was transformed.
        id (str):
        tiers (list[MapResourceTiersItem]):
        tiles (MapResourceTiles):
        title (str):
        topology (MapResourceTopology): Borders are compiled once and shared by the two areas along them, so a tier
            cannot draw the same border two ways.
    """

    arc_count: int
    area_count: int
    attribution: MapResourceAttribution
    boundary_release: str
    bounds: list[float]
    features: list[MapResourceFeaturesItem]
    generalisation: MapResourceGeneralisation
    geography: str
    geometry_source: MapResourceGeometrySource
    id: str
    tiers: list[MapResourceTiersItem]
    tiles: MapResourceTiles
    title: str
    topology: MapResourceTopology
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        arc_count = self.arc_count

        area_count = self.area_count

        attribution = self.attribution.to_dict()

        boundary_release = self.boundary_release

        bounds = self.bounds

        features = []
        for features_item_data in self.features:
            features_item = features_item_data.to_dict()
            features.append(features_item)

        generalisation = self.generalisation.to_dict()

        geography = self.geography

        geometry_source = self.geometry_source.to_dict()

        id = self.id

        tiers = []
        for tiers_item_data in self.tiers:
            tiers_item = tiers_item_data.to_dict()
            tiers.append(tiers_item)

        tiles = self.tiles.to_dict()

        title = self.title

        topology = self.topology.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "arcCount": arc_count,
                "areaCount": area_count,
                "attribution": attribution,
                "boundaryRelease": boundary_release,
                "bounds": bounds,
                "features": features,
                "generalisation": generalisation,
                "geography": geography,
                "geometrySource": geometry_source,
                "id": id,
                "tiers": tiers,
                "tiles": tiles,
                "title": title,
                "topology": topology,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.map_resource_attribution import MapResourceAttribution
        from ..models.map_resource_features_item import MapResourceFeaturesItem
        from ..models.map_resource_generalisation import MapResourceGeneralisation
        from ..models.map_resource_geometry_source import MapResourceGeometrySource
        from ..models.map_resource_tiers_item import MapResourceTiersItem
        from ..models.map_resource_tiles import MapResourceTiles

        d = dict(src_dict)
        arc_count = d.pop("arcCount")

        area_count = d.pop("areaCount")

        attribution = MapResourceAttribution.from_dict(d.pop("attribution"))

        boundary_release = d.pop("boundaryRelease")

        bounds = cast(list[float], d.pop("bounds"))

        features = []
        _features = d.pop("features")
        for features_item_data in _features:
            features_item = MapResourceFeaturesItem.from_dict(features_item_data)

            features.append(features_item)

        generalisation = MapResourceGeneralisation.from_dict(d.pop("generalisation"))

        geography = d.pop("geography")

        geometry_source = MapResourceGeometrySource.from_dict(d.pop("geometrySource"))

        id = d.pop("id")

        tiers = []
        _tiers = d.pop("tiers")
        for tiers_item_data in _tiers:
            tiers_item = MapResourceTiersItem.from_dict(tiers_item_data)

            tiers.append(tiers_item)

        tiles = MapResourceTiles.from_dict(d.pop("tiles"))

        title = d.pop("title")

        topology = MapResourceTopology(d.pop("topology"))

        map_resource = cls(
            arc_count=arc_count,
            area_count=area_count,
            attribution=attribution,
            boundary_release=boundary_release,
            bounds=bounds,
            features=features,
            generalisation=generalisation,
            geography=geography,
            geometry_source=geometry_source,
            id=id,
            tiers=tiers,
            tiles=tiles,
            title=title,
            topology=topology,
        )

        map_resource.additional_properties = d
        return map_resource

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
