from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="CompactPointLookupResultMatchesItem")


@_attrs_define
class CompactPointLookupResultMatchesItem:
    """
    Attributes:
        code (str):
        id (str):
        name (str):
        near_boundary (bool):
    """

    code: str
    id: str
    name: str
    near_boundary: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        code = self.code

        id = self.id

        name = self.name

        near_boundary = self.near_boundary

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "code": code,
                "id": id,
                "name": name,
                "nearBoundary": near_boundary,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        code = d.pop("code")

        id = d.pop("id")

        name = d.pop("name")

        near_boundary = d.pop("nearBoundary")

        compact_point_lookup_result_matches_item = cls(
            code=code,
            id=id,
            name=name,
            near_boundary=near_boundary,
        )

        compact_point_lookup_result_matches_item.additional_properties = d
        return compact_point_lookup_result_matches_item

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
