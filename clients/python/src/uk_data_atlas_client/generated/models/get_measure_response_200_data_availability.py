from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="GetMeasureResponse200DataAvailability")


@_attrs_define
class GetMeasureResponse200DataAvailability:
    """
    Attributes:
        aggregation (bool):
        conversion (bool):
        source_exact (bool):
    """

    aggregation: bool
    conversion: bool
    source_exact: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        aggregation = self.aggregation

        conversion = self.conversion

        source_exact = self.source_exact

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "aggregation": aggregation,
                "conversion": conversion,
                "sourceExact": source_exact,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        aggregation = d.pop("aggregation")

        conversion = d.pop("conversion")

        source_exact = d.pop("sourceExact")

        get_measure_response_200_data_availability = cls(
            aggregation=aggregation,
            conversion=conversion,
            source_exact=source_exact,
        )

        get_measure_response_200_data_availability.additional_properties = d
        return get_measure_response_200_data_availability

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
