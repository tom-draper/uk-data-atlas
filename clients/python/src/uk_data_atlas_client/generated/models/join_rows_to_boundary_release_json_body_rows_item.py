from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="JoinRowsToBoundaryReleaseJsonBodyRowsItem")


@_attrs_define
class JoinRowsToBoundaryReleaseJsonBodyRowsItem:
    """
    Attributes:
        area (str | Unset):
        code (str | Unset):
        name (str | Unset):
        parent (str | Unset):
        value (bool | float | None | str | Unset):
    """

    area: str | Unset = UNSET
    code: str | Unset = UNSET
    name: str | Unset = UNSET
    parent: str | Unset = UNSET
    value: bool | float | None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        area = self.area

        code = self.code

        name = self.name

        parent = self.parent

        value: bool | float | None | str | Unset
        if isinstance(self.value, Unset):
            value = UNSET
        else:
            value = self.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if area is not UNSET:
            field_dict["area"] = area
        if code is not UNSET:
            field_dict["code"] = code
        if name is not UNSET:
            field_dict["name"] = name
        if parent is not UNSET:
            field_dict["parent"] = parent
        if value is not UNSET:
            field_dict["value"] = value

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        area = d.pop("area", UNSET)

        code = d.pop("code", UNSET)

        name = d.pop("name", UNSET)

        parent = d.pop("parent", UNSET)

        def _parse_value(data: object) -> bool | float | None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(bool | float | None | str | Unset, data)

        value = _parse_value(d.pop("value", UNSET))

        join_rows_to_boundary_release_json_body_rows_item = cls(
            area=area,
            code=code,
            name=name,
            parent=parent,
            value=value,
        )

        join_rows_to_boundary_release_json_body_rows_item.additional_properties = d
        return join_rows_to_boundary_release_json_body_rows_item

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
