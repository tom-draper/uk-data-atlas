from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar(
    "T",
    bound="CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingFrom",
)


@_attrs_define
class CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingFrom:
    """
    Attributes:
        multiple_target_count (int):
        no_target_count (int):
        one_target_count (int):
    """

    multiple_target_count: int
    no_target_count: int
    one_target_count: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        multiple_target_count = self.multiple_target_count

        no_target_count = self.no_target_count

        one_target_count = self.one_target_count

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "multipleTargetCount": multiple_target_count,
                "noTargetCount": no_target_count,
                "oneTargetCount": one_target_count,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        multiple_target_count = d.pop("multipleTargetCount")

        no_target_count = d.pop("noTargetCount")

        one_target_count = d.pop("oneTargetCount")

        compare_boundary_releases_response_200_data_published_relationships_item_mapping_from = cls(
            multiple_target_count=multiple_target_count,
            no_target_count=no_target_count,
            one_target_count=one_target_count,
        )

        compare_boundary_releases_response_200_data_published_relationships_item_mapping_from.additional_properties = d
        return compare_boundary_releases_response_200_data_published_relationships_item_mapping_from

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
