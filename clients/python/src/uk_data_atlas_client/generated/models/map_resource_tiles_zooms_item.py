from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="MapResourceTilesZoomsItem")


@_attrs_define
class MapResourceTilesZoomsItem:
    """
    Attributes:
        max_zoom (int):
        min_zoom (int):
        tier (str):
        tolerance_m (float):
    """

    max_zoom: int
    min_zoom: int
    tier: str
    tolerance_m: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        max_zoom = self.max_zoom

        min_zoom = self.min_zoom

        tier = self.tier

        tolerance_m = self.tolerance_m

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "maxZoom": max_zoom,
                "minZoom": min_zoom,
                "tier": tier,
                "toleranceM": tolerance_m,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        max_zoom = d.pop("maxZoom")

        min_zoom = d.pop("minZoom")

        tier = d.pop("tier")

        tolerance_m = d.pop("toleranceM")

        map_resource_tiles_zooms_item = cls(
            max_zoom=max_zoom,
            min_zoom=min_zoom,
            tier=tier,
            tolerance_m=tolerance_m,
        )

        map_resource_tiles_zooms_item.additional_properties = d
        return map_resource_tiles_zooms_item

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
