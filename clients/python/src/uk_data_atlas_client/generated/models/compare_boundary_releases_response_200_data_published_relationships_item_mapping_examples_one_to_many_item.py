from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar(
    "T",
    bound="CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingExamplesOneToManyItem",
)


@_attrs_define
class CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingExamplesOneToManyItem:
    """
    Attributes:
        from_code (str):
        to_codes (list[str]):
    """

    from_code: str
    to_codes: list[str]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from_code = self.from_code

        to_codes = self.to_codes

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "fromCode": from_code,
                "toCodes": to_codes,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        from_code = d.pop("fromCode")

        to_codes = cast(list[str], d.pop("toCodes"))

        compare_boundary_releases_response_200_data_published_relationships_item_mapping_examples_one_to_many_item = cls(
            from_code=from_code,
            to_codes=to_codes,
        )

        compare_boundary_releases_response_200_data_published_relationships_item_mapping_examples_one_to_many_item.additional_properties = d
        return compare_boundary_releases_response_200_data_published_relationships_item_mapping_examples_one_to_many_item

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
