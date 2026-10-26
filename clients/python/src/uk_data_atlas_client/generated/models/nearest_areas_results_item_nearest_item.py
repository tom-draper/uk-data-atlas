from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.geometry_source import GeometrySource


T = TypeVar("T", bound="NearestAreasResultsItemNearestItem")


@_attrs_define
class NearestAreasResultsItemNearestItem:
    """
    Attributes:
        code (str):
        distance_m (float): Metres to the area, zero when the point is on or inside it. Not a containment claim.
        id (str):
        name (str):
        rank (int):
        geometry_source (GeometrySource | Unset): Where the served WGS84 geometry came from. `transformation` is present
            only when the source was reprojected. Per-area compiled geometry carries `validity`; release-wide provenance and
            direct source reads omit it.
    """

    code: str
    distance_m: float
    id: str
    name: str
    rank: int
    geometry_source: GeometrySource | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        code = self.code

        distance_m = self.distance_m

        id = self.id

        name = self.name

        rank = self.rank

        geometry_source: dict[str, Any] | Unset = UNSET
        if not isinstance(self.geometry_source, Unset):
            geometry_source = self.geometry_source.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "code": code,
                "distanceM": distance_m,
                "id": id,
                "name": name,
                "rank": rank,
            }
        )
        if geometry_source is not UNSET:
            field_dict["geometrySource"] = geometry_source

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.geometry_source import GeometrySource

        d = dict(src_dict)
        code = d.pop("code")

        distance_m = d.pop("distanceM")

        id = d.pop("id")

        name = d.pop("name")

        rank = d.pop("rank")

        _geometry_source = d.pop("geometrySource", UNSET)
        geometry_source: GeometrySource | Unset
        if isinstance(_geometry_source, Unset):
            geometry_source = UNSET
        else:
            geometry_source = GeometrySource.from_dict(_geometry_source)

        nearest_areas_results_item_nearest_item = cls(
            code=code,
            distance_m=distance_m,
            id=id,
            name=name,
            rank=rank,
            geometry_source=geometry_source,
        )

        nearest_areas_results_item_nearest_item.additional_properties = d
        return nearest_areas_results_item_nearest_item

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
