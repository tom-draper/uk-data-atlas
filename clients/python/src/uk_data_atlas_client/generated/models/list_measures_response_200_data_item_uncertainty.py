from __future__ import annotations

from collections.abc import Mapping
from typing import (
    Any,
    Literal,
    Self,
    TypeVar,
    cast,
)

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="ListMeasuresResponse200DataItemUncertainty")


@_attrs_define
class ListMeasuresResponse200DataItemUncertainty:
    """
    Attributes:
        kind (Literal['confidence-interval']):
        level (float):
        note (str):
    """

    kind: Literal["confidence-interval"]
    level: float
    note: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        level = self.level

        note = self.note

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "kind": kind,
                "level": level,
                "note": note,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        kind = cast(Literal["confidence-interval"], d.pop("kind"))
        if kind != "confidence-interval":
            raise ValueError(
                f"kind must match const 'confidence-interval', got '{kind}'"
            )

        level = d.pop("level")

        note = d.pop("note")

        list_measures_response_200_data_item_uncertainty = cls(
            kind=kind,
            level=level,
            note=note,
        )

        list_measures_response_200_data_item_uncertainty.additional_properties = d
        return list_measures_response_200_data_item_uncertainty

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
