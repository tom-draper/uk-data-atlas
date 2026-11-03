from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.map_resource_tiles_format import MapResourceTilesFormat
from ..models.map_resource_tiles_tile_format import MapResourceTilesTileFormat

if TYPE_CHECKING:
    from ..models.map_resource_tiles_zooms_item import MapResourceTilesZoomsItem


T = TypeVar("T", bound="MapResourceTiles")


@_attrs_define
class MapResourceTiles:
    """
    Attributes:
        artifact (str):
        bytes_ (int):
        content_hash (str): SHA-256 of the archive, so a cited map can be checked.
        format_ (MapResourceTilesFormat):
        href (str):
        layer (str):
        max_zoom (int):
        min_zoom (int):
        tile_count (int):
        tile_format (MapResourceTilesTileFormat):
        zooms (list[MapResourceTilesZoomsItem]): Which generalisation tier each band of zooms is drawn from.
    """

    artifact: str
    bytes_: int
    content_hash: str
    format_: MapResourceTilesFormat
    href: str
    layer: str
    max_zoom: int
    min_zoom: int
    tile_count: int
    tile_format: MapResourceTilesTileFormat
    zooms: list[MapResourceTilesZoomsItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        artifact = self.artifact

        bytes_ = self.bytes_

        content_hash = self.content_hash

        format_ = self.format_.value

        href = self.href

        layer = self.layer

        max_zoom = self.max_zoom

        min_zoom = self.min_zoom

        tile_count = self.tile_count

        tile_format = self.tile_format.value

        zooms = []
        for zooms_item_data in self.zooms:
            zooms_item = zooms_item_data.to_dict()
            zooms.append(zooms_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "artifact": artifact,
                "bytes": bytes_,
                "contentHash": content_hash,
                "format": format_,
                "href": href,
                "layer": layer,
                "maxZoom": max_zoom,
                "minZoom": min_zoom,
                "tileCount": tile_count,
                "tileFormat": tile_format,
                "zooms": zooms,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.map_resource_tiles_zooms_item import MapResourceTilesZoomsItem

        d = dict(src_dict)
        artifact = d.pop("artifact")

        bytes_ = d.pop("bytes")

        content_hash = d.pop("contentHash")

        format_ = MapResourceTilesFormat(d.pop("format"))

        href = d.pop("href")

        layer = d.pop("layer")

        max_zoom = d.pop("maxZoom")

        min_zoom = d.pop("minZoom")

        tile_count = d.pop("tileCount")

        tile_format = MapResourceTilesTileFormat(d.pop("tileFormat"))

        zooms = []
        _zooms = d.pop("zooms")
        for zooms_item_data in _zooms:
            zooms_item = MapResourceTilesZoomsItem.from_dict(zooms_item_data)

            zooms.append(zooms_item)

        map_resource_tiles = cls(
            artifact=artifact,
            bytes_=bytes_,
            content_hash=content_hash,
            format_=format_,
            href=href,
            layer=layer,
            max_zoom=max_zoom,
            min_zoom=min_zoom,
            tile_count=tile_count,
            tile_format=tile_format,
            zooms=zooms,
        )

        map_resource_tiles.additional_properties = d
        return map_resource_tiles

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
