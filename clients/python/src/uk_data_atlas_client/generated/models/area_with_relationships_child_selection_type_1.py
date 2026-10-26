from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.area_with_relationships_child_selection_type_1_kind import (
    AreaWithRelationshipsChildSelectionType1Kind,
)

T = TypeVar("T", bound="AreaWithRelationshipsChildSelectionType1")


@_attrs_define
class AreaWithRelationshipsChildSelectionType1:
    """
    Attributes:
        geography (str):
        kind (AreaWithRelationshipsChildSelectionType1Kind):
        release (str):
    """

    geography: str
    kind: AreaWithRelationshipsChildSelectionType1Kind
    release: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        geography = self.geography

        kind = self.kind.value

        release = self.release

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "geography": geography,
                "kind": kind,
                "release": release,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        geography = d.pop("geography")

        kind = AreaWithRelationshipsChildSelectionType1Kind(d.pop("kind"))

        release = d.pop("release")

        area_with_relationships_child_selection_type_1 = cls(
            geography=geography,
            kind=kind,
            release=release,
        )

        area_with_relationships_child_selection_type_1.additional_properties = d
        return area_with_relationships_child_selection_type_1

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
