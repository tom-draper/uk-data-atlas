from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="MapResourceJoinValuesItem")


@_attrs_define
class MapResourceJoinValuesItem:
    """
    Attributes:
        code (str):
        id (int): The tile feature id this value belongs to.
        status (str): `observed` where a publisher reported it, `derived` where this API computed it.
        value (float):
    """

    code: str
    id: int
    status: str
    value: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        code = self.code

        id = self.id

        status = self.status

        value = self.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "code": code,
                "id": id,
                "status": status,
                "value": value,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        code = d.pop("code")

        id = d.pop("id")

        status = d.pop("status")

        value = d.pop("value")

        map_resource_join_values_item = cls(
            code=code,
            id=id,
            status=status,
            value=value,
        )

        map_resource_join_values_item.additional_properties = d
        return map_resource_join_values_item

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
