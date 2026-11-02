from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="GeographyInventoryGeographiesItemCapabilitiesAreaIdentities")


@_attrs_define
class GeographyInventoryGeographiesItemCapabilitiesAreaIdentities:
    """
    Attributes:
        available_area_count (int):
        available_release_count (int):
        unsupported_release_count (int):
    """

    available_area_count: int
    available_release_count: int
    unsupported_release_count: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        available_area_count = self.available_area_count

        available_release_count = self.available_release_count

        unsupported_release_count = self.unsupported_release_count

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "availableAreaCount": available_area_count,
                "availableReleaseCount": available_release_count,
                "unsupportedReleaseCount": unsupported_release_count,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        available_area_count = d.pop("availableAreaCount")

        available_release_count = d.pop("availableReleaseCount")

        unsupported_release_count = d.pop("unsupportedReleaseCount")

        geography_inventory_geographies_item_capabilities_area_identities = cls(
            available_area_count=available_area_count,
            available_release_count=available_release_count,
            unsupported_release_count=unsupported_release_count,
        )

        geography_inventory_geographies_item_capabilities_area_identities.additional_properties = d
        return geography_inventory_geographies_item_capabilities_area_identities

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
