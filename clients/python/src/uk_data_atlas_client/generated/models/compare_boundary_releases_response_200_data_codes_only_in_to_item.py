from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="CompareBoundaryReleasesResponse200DataCodesOnlyInToItem")


@_attrs_define
class CompareBoundaryReleasesResponse200DataCodesOnlyInToItem:
    """
    Attributes:
        code (str):
        id (str):
        name (str):
        aliases (list[str] | Unset):
    """

    code: str
    id: str
    name: str
    aliases: list[str] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        code = self.code

        id = self.id

        name = self.name

        aliases: list[str] | Unset = UNSET
        if not isinstance(self.aliases, Unset):
            aliases = self.aliases

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

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        code = d.pop("code")

        id = d.pop("id")

        name = d.pop("name")

        aliases = cast(list[str], d.pop("aliases", UNSET))

        compare_boundary_releases_response_200_data_codes_only_in_to_item = cls(
            code=code,
            id=id,
            name=name,
            aliases=aliases,
        )

        compare_boundary_releases_response_200_data_codes_only_in_to_item.additional_properties = d
        return compare_boundary_releases_response_200_data_codes_only_in_to_item

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
