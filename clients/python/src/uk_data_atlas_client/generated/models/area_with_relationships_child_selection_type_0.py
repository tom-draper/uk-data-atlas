from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.area_with_relationships_child_selection_type_0_kind import (
    AreaWithRelationshipsChildSelectionType0Kind,
)
from ..types import UNSET, Unset

T = TypeVar("T", bound="AreaWithRelationshipsChildSelectionType0")


@_attrs_define
class AreaWithRelationshipsChildSelectionType0:
    """
    Attributes:
        kind (AreaWithRelationshipsChildSelectionType0Kind):
        geography (str | Unset):
    """

    kind: AreaWithRelationshipsChildSelectionType0Kind
    geography: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        geography = self.geography

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "kind": kind,
            }
        )
        if geography is not UNSET:
            field_dict["geography"] = geography

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        kind = AreaWithRelationshipsChildSelectionType0Kind(d.pop("kind"))

        geography = d.pop("geography", UNSET)

        area_with_relationships_child_selection_type_0 = cls(
            kind=kind,
            geography=geography,
        )

        area_with_relationships_child_selection_type_0.additional_properties = d
        return area_with_relationships_child_selection_type_0

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
