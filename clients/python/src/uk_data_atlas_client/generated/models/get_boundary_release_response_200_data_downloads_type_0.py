from __future__ import annotations

from collections.abc import Mapping
from typing import (
    TYPE_CHECKING,
    Any,
    Literal,
    Self,
    TypeVar,
    cast,
)

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.get_boundary_release_response_200_data_downloads_type_0_geojson import (
        GetBoundaryReleaseResponse200DataDownloadsType0Geojson,
    )
    from ..models.get_boundary_release_response_200_data_downloads_type_0_geoparquet import (
        GetBoundaryReleaseResponse200DataDownloadsType0Geoparquet,
    )


T = TypeVar("T", bound="GetBoundaryReleaseResponse200DataDownloadsType0")


@_attrs_define
class GetBoundaryReleaseResponse200DataDownloadsType0:
    """
    Attributes:
        geojson (GetBoundaryReleaseResponse200DataDownloadsType0Geojson): The download for the medium and low tiers.
        geoparquet (GetBoundaryReleaseResponse200DataDownloadsType0Geoparquet): GeoParquet downloads by tier.
        map_resource (str): The descriptor, with sizes, hashes and attribution.
        pmtiles (str):
        status (Literal['available']):
        tile_json (str):
    """

    geojson: GetBoundaryReleaseResponse200DataDownloadsType0Geojson
    geoparquet: GetBoundaryReleaseResponse200DataDownloadsType0Geoparquet
    map_resource: str
    pmtiles: str
    status: Literal["available"]
    tile_json: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        geojson = self.geojson.to_dict()

        geoparquet = self.geoparquet.to_dict()

        map_resource = self.map_resource

        pmtiles = self.pmtiles

        status = self.status

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
        from ..models.get_boundary_release_response_200_data_downloads_type_0_geojson import (
            GetBoundaryReleaseResponse200DataDownloadsType0Geojson,
        )
        from ..models.get_boundary_release_response_200_data_downloads_type_0_geoparquet import (
            GetBoundaryReleaseResponse200DataDownloadsType0Geoparquet,
        )

        d = dict(src_dict)
        geojson = GetBoundaryReleaseResponse200DataDownloadsType0Geojson.from_dict(
            d.pop("geojson")
        )

        geoparquet = (
            GetBoundaryReleaseResponse200DataDownloadsType0Geoparquet.from_dict(
                d.pop("geoparquet")
            )
        )

        map_resource = d.pop("mapResource")

        pmtiles = d.pop("pmtiles")

        status = cast(Literal["available"], d.pop("status"))
        if status != "available":
            raise ValueError(f"status must match const 'available', got '{status}'")

        tile_json = d.pop("tileJson")

        get_boundary_release_response_200_data_downloads_type_0 = cls(
            geojson=geojson,
            geoparquet=geoparquet,
            map_resource=map_resource,
            pmtiles=pmtiles,
            status=status,
            tile_json=tile_json,
        )

        get_boundary_release_response_200_data_downloads_type_0.additional_properties = d
        return get_boundary_release_response_200_data_downloads_type_0

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
