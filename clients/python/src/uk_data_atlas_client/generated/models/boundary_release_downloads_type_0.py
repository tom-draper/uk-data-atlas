from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.boundary_release_downloads_type_0_status import (
    BoundaryReleaseDownloadsType0Status,
)

if TYPE_CHECKING:
    from ..models.download_urls import DownloadUrls


T = TypeVar("T", bound="BoundaryReleaseDownloadsType0")


@_attrs_define
class BoundaryReleaseDownloadsType0:
    """
    Attributes:
        geojson (DownloadUrls):
        geoparquet (DownloadUrls):
        map_resource (str): The descriptor, with sizes, hashes and attribution.
        pmtiles (str):
        status (BoundaryReleaseDownloadsType0Status):
        tile_json (str):
    """

    geojson: DownloadUrls
    geoparquet: DownloadUrls
    map_resource: str
    pmtiles: str
    status: BoundaryReleaseDownloadsType0Status
    tile_json: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        geojson = self.geojson.to_dict()

        geoparquet = self.geoparquet.to_dict()

        map_resource = self.map_resource

        pmtiles = self.pmtiles

        status = self.status.value

        tile_json = self.tile_json

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "geojson": geojson,
                "geoparquet": geoparquet,
                "mapResource": map_resource,
                "pmtiles": pmtiles,
                "status": status,
                "tileJson": tile_json,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.download_urls import DownloadUrls

        d = dict(src_dict)
        geojson = DownloadUrls.from_dict(d.pop("geojson"))

        geoparquet = DownloadUrls.from_dict(d.pop("geoparquet"))

        map_resource = d.pop("mapResource")

        pmtiles = d.pop("pmtiles")

        status = BoundaryReleaseDownloadsType0Status(d.pop("status"))

        tile_json = d.pop("tileJson")

        boundary_release_downloads_type_0 = cls(
            geojson=geojson,
            geoparquet=geoparquet,
            map_resource=map_resource,
            pmtiles=pmtiles,
            status=status,
            tile_json=tile_json,
        )

        boundary_release_downloads_type_0.additional_properties = d
        return boundary_release_downloads_type_0

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
