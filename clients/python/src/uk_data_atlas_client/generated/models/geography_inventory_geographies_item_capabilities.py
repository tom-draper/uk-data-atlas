from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.geography_inventory_geographies_item_capabilities_area_identities import (
        GeographyInventoryGeographiesItemCapabilitiesAreaIdentities,
    )
    from ..models.geography_inventory_geographies_item_capabilities_relationships import (
        GeographyInventoryGeographiesItemCapabilitiesRelationships,
    )


T = TypeVar("T", bound="GeographyInventoryGeographiesItemCapabilities")


@_attrs_define
class GeographyInventoryGeographiesItemCapabilities:
    """
    Attributes:
        area_identities (GeographyInventoryGeographiesItemCapabilitiesAreaIdentities):
        relationships (GeographyInventoryGeographiesItemCapabilitiesRelationships):
    """

    area_identities: GeographyInventoryGeographiesItemCapabilitiesAreaIdentities
    relationships: GeographyInventoryGeographiesItemCapabilitiesRelationships
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        area_identities = self.area_identities.to_dict()

        relationships = self.relationships.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "areaIdentities": area_identities,
                "relationships": relationships,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.geography_inventory_geographies_item_capabilities_area_identities import (
            GeographyInventoryGeographiesItemCapabilitiesAreaIdentities,
        )
        from ..models.geography_inventory_geographies_item_capabilities_relationships import (
            GeographyInventoryGeographiesItemCapabilitiesRelationships,
        )

        d = dict(src_dict)
        area_identities = (
            GeographyInventoryGeographiesItemCapabilitiesAreaIdentities.from_dict(
                d.pop("areaIdentities")
            )
        )

        relationships = (
            GeographyInventoryGeographiesItemCapabilitiesRelationships.from_dict(
                d.pop("relationships")
            )
        )

        geography_inventory_geographies_item_capabilities = cls(
            area_identities=area_identities,
            relationships=relationships,
        )

        geography_inventory_geographies_item_capabilities.additional_properties = d
        return geography_inventory_geographies_item_capabilities

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
