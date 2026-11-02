from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.geography_inventory_schema_version import GeographyInventorySchemaVersion

if TYPE_CHECKING:
    from ..models.geography_inventory_geographies_item import (
        GeographyInventoryGeographiesItem,
    )
    from ..models.geography_release_inventory import GeographyReleaseInventory


T = TypeVar("T", bound="GeographyInventory")


@_attrs_define
class GeographyInventory:
    """
    Attributes:
        boundary_registry_hash (str):
        content_hash (str):
        geographies (list[GeographyInventoryGeographiesItem]):
        releases (list[GeographyReleaseInventory]):
        schema_version (GeographyInventorySchemaVersion):
    """

    boundary_registry_hash: str
    content_hash: str
    geographies: list[GeographyInventoryGeographiesItem]
    releases: list[GeographyReleaseInventory]
    schema_version: GeographyInventorySchemaVersion
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        boundary_registry_hash = self.boundary_registry_hash

        content_hash = self.content_hash

        geographies = []
        for geographies_item_data in self.geographies:
            geographies_item = geographies_item_data.to_dict()
            geographies.append(geographies_item)

        releases = []
        for releases_item_data in self.releases:
            releases_item = releases_item_data.to_dict()
            releases.append(releases_item)

        schema_version = self.schema_version.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "boundaryRegistryHash": boundary_registry_hash,
                "contentHash": content_hash,
                "geographies": geographies,
                "releases": releases,
                "schemaVersion": schema_version,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.geography_inventory_geographies_item import (
            GeographyInventoryGeographiesItem,
        )
        from ..models.geography_release_inventory import GeographyReleaseInventory

        d = dict(src_dict)
        boundary_registry_hash = d.pop("boundaryRegistryHash")

        content_hash = d.pop("contentHash")

        geographies = []
        _geographies = d.pop("geographies")
        for geographies_item_data in _geographies:
            geographies_item = GeographyInventoryGeographiesItem.from_dict(
                geographies_item_data
            )

            geographies.append(geographies_item)

        releases = []
        _releases = d.pop("releases")
        for releases_item_data in _releases:
            releases_item = GeographyReleaseInventory.from_dict(releases_item_data)

            releases.append(releases_item)

        schema_version = GeographyInventorySchemaVersion(d.pop("schemaVersion"))

        geography_inventory = cls(
            boundary_registry_hash=boundary_registry_hash,
            content_hash=content_hash,
            geographies=geographies,
            releases=releases,
            schema_version=schema_version,
        )

        geography_inventory.additional_properties = d
        return geography_inventory

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
