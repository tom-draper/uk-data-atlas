from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar(
    "T",
    bound="CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingTo",
)


@_attrs_define
class CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingTo:
    """
    Attributes:
        multiple_source_count (int):
        one_source_count (int):
    """

    multiple_source_count: int
    one_source_count: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        multiple_source_count = self.multiple_source_count

        one_source_count = self.one_source_count

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "multipleSourceCount": multiple_source_count,
                "oneSourceCount": one_source_count,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        multiple_source_count = d.pop("multipleSourceCount")

        one_source_count = d.pop("oneSourceCount")

        compare_boundary_releases_response_200_data_published_relationships_item_mapping_to = cls(
            multiple_source_count=multiple_source_count,
            one_source_count=one_source_count,
        )

        compare_boundary_releases_response_200_data_published_relationships_item_mapping_to.additional_properties = d
        return compare_boundary_releases_response_200_data_published_relationships_item_mapping_to

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
