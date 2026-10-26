from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="RelationshipCandidateTarget")


@_attrs_define
class RelationshipCandidateTarget:
    """`boundaryRelease` (and sometimes `geography`) are present only when exactly one compiled area release already uses
    this code/name property pair.

        Attributes:
            code_property (str):
            name_property (str):
            boundary_release (str | Unset):
            geography (str | Unset):
    """

    code_property: str
    name_property: str
    boundary_release: str | Unset = UNSET
    geography: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        code_property = self.code_property

        name_property = self.name_property

        boundary_release = self.boundary_release

        geography = self.geography

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "codeProperty": code_property,
                "nameProperty": name_property,
            }
        )
        if boundary_release is not UNSET:
            field_dict["boundaryRelease"] = boundary_release
        if geography is not UNSET:
            field_dict["geography"] = geography

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        code_property = d.pop("codeProperty")

        name_property = d.pop("nameProperty")

        boundary_release = d.pop("boundaryRelease", UNSET)

        geography = d.pop("geography", UNSET)

        relationship_candidate_target = cls(
            code_property=code_property,
            name_property=name_property,
            boundary_release=boundary_release,
            geography=geography,
        )

        relationship_candidate_target.additional_properties = d
        return relationship_candidate_target

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
