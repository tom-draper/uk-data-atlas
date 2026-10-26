from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="SuppliedCountConversionEnvelopeDataInput")


@_attrs_define
class SuppliedCountConversionEnvelopeDataInput:
    """
    Attributes:
        content_hash (str):
        normalised_count (int):
        row_count (int):
    """

    content_hash: str
    normalised_count: int
    row_count: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        content_hash = self.content_hash

        normalised_count = self.normalised_count

        row_count = self.row_count

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "contentHash": content_hash,
                "normalisedCount": normalised_count,
                "rowCount": row_count,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        content_hash = d.pop("contentHash")

        normalised_count = d.pop("normalisedCount")

        row_count = d.pop("rowCount")

        supplied_count_conversion_envelope_data_input = cls(
            content_hash=content_hash,
            normalised_count=normalised_count,
            row_count=row_count,
        )

        supplied_count_conversion_envelope_data_input.additional_properties = d
        return supplied_count_conversion_envelope_data_input

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
