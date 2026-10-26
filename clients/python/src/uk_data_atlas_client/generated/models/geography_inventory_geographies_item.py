from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.geography_inventory_geographies_item_capabilities import (
        GeographyInventoryGeographiesItemCapabilities,
    )


T = TypeVar("T", bound="GeographyInventoryGeographiesItem")


@_attrs_define
class GeographyInventoryGeographiesItem:
    """
    Attributes:
        capabilities (GeographyInventoryGeographiesItemCapabilities):
        countries (list[str]):
        id (str):
        release_count (int):
    """

    capabilities: GeographyInventoryGeographiesItemCapabilities
    countries: list[str]
    id: str
    release_count: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        capabilities = self.capabilities.to_dict()

        countries = self.countries

        id = self.id

        release_count = self.release_count

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "capabilities": capabilities,
                "countries": countries,
                "id": id,
                "releaseCount": release_count,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.geography_inventory_geographies_item_capabilities import (
            GeographyInventoryGeographiesItemCapabilities,
        )

        d = dict(src_dict)
        capabilities = GeographyInventoryGeographiesItemCapabilities.from_dict(
            d.pop("capabilities")
        )

        countries = cast(list[str], d.pop("countries"))

        id = d.pop("id")

        release_count = d.pop("releaseCount")

        geography_inventory_geographies_item = cls(
            capabilities=capabilities,
            countries=countries,
            id=id,
            release_count=release_count,
        )

        geography_inventory_geographies_item.additional_properties = d
        return geography_inventory_geographies_item

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
