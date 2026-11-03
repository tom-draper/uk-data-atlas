from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="GetMeasureResponse200DataUnitDefinition")


@_attrs_define
class GetMeasureResponse200DataUnitDefinition:
    """
    Attributes:
        code (str):
        scale_to_canonical (float):
        per (str | Unset):
    """

    code: str
    scale_to_canonical: float
    per: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        code = self.code

        scale_to_canonical = self.scale_to_canonical

        per = self.per

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "code": code,
                "scaleToCanonical": scale_to_canonical,
            }
        )
        if per is not UNSET:
            field_dict["per"] = per

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        code = d.pop("code")

        scale_to_canonical = d.pop("scaleToCanonical")

        per = d.pop("per", UNSET)

        get_measure_response_200_data_unit_definition = cls(
            code=code,
            scale_to_canonical=scale_to_canonical,
            per=per,
        )

        get_measure_response_200_data_unit_definition.additional_properties = d
        return get_measure_response_200_data_unit_definition

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
