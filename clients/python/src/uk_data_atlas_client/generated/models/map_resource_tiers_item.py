from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="MapResourceTiersItem")


@_attrs_define
class MapResourceTiersItem:
    """
    Attributes:
        coordinates (int):
        refined_arcs (int): Arcs given back detail because a ring built from them enclosed nothing at this tier, so no
            part leaves the map.
        tier (str):
        tolerance_m (float):
    """

    coordinates: int
    refined_arcs: int
    tier: str
    tolerance_m: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        coordinates = self.coordinates

        refined_arcs = self.refined_arcs

        tier = self.tier

        tolerance_m = self.tolerance_m

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "coordinates": coordinates,
                "refinedArcs": refined_arcs,
                "tier": tier,
                "toleranceM": tolerance_m,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        coordinates = d.pop("coordinates")

        refined_arcs = d.pop("refinedArcs")

        tier = d.pop("tier")

        tolerance_m = d.pop("toleranceM")

        map_resource_tiers_item = cls(
            coordinates=coordinates,
            refined_arcs=refined_arcs,
            tier=tier,
            tolerance_m=tolerance_m,
        )

        map_resource_tiers_item.additional_properties = d
        return map_resource_tiers_item

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
