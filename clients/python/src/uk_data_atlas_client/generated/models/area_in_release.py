from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="AreaInRelease")


@_attrs_define
class AreaInRelease:
    """An area listed under a response that already states its geography and boundary release, which are not repeated for
    each area.

        Attributes:
            code (str):
            id (str):
            name (str):
            aliases (list[str] | Unset):
            boundary_release (str | Unset):
            geography (str | Unset):
    """

    code: str
    id: str
    name: str
    aliases: list[str] | Unset = UNSET
    boundary_release: str | Unset = UNSET
    geography: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        code = self.code

        id = self.id

        name = self.name

        aliases: list[str] | Unset = UNSET
        if not isinstance(self.aliases, Unset):
            aliases = self.aliases

        boundary_release = self.boundary_release

        geography = self.geography

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "code": code,
                "id": id,
                "name": name,
            }
        )
        if aliases is not UNSET:
            field_dict["aliases"] = aliases
        if boundary_release is not UNSET:
            field_dict["boundaryRelease"] = boundary_release
        if geography is not UNSET:
            field_dict["geography"] = geography

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        code = d.pop("code")

        id = d.pop("id")

        name = d.pop("name")

        aliases = cast(list[str], d.pop("aliases", UNSET))

        boundary_release = d.pop("boundaryRelease", UNSET)

        geography = d.pop("geography", UNSET)

        area_in_release = cls(
            code=code,
            id=id,
            name=name,
            aliases=aliases,
            boundary_release=boundary_release,
            geography=geography,
        )

        area_in_release.additional_properties = d
        return area_in_release

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
