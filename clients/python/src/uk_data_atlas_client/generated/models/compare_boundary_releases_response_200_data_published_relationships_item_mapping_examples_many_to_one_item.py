from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar(
    "T",
    bound="CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingExamplesManyToOneItem",
)


@_attrs_define
class CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingExamplesManyToOneItem:
    """
    Attributes:
        from_codes (list[str]):
        to_code (str):
    """

    from_codes: list[str]
    to_code: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from_codes = self.from_codes

        to_code = self.to_code

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "fromCodes": from_codes,
                "toCode": to_code,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        from_codes = cast(list[str], d.pop("fromCodes"))

        to_code = d.pop("toCode")

        compare_boundary_releases_response_200_data_published_relationships_item_mapping_examples_many_to_one_item = cls(
            from_codes=from_codes,
            to_code=to_code,
        )

        compare_boundary_releases_response_200_data_published_relationships_item_mapping_examples_many_to_one_item.additional_properties = d
        return compare_boundary_releases_response_200_data_published_relationships_item_mapping_examples_many_to_one_item

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
