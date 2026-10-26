from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.analysis_geography_validation_envelope_data_supports_item_periods_item_method import (
    AnalysisGeographyValidationEnvelopeDataSupportsItemPeriodsItemMethod,
)

T = TypeVar("T", bound="AnalysisGeographyValidationEnvelopeDataSupportsItemPeriodsItem")


@_attrs_define
class AnalysisGeographyValidationEnvelopeDataSupportsItemPeriodsItem:
    """
    Attributes:
        input_record_count (int):
        input_total (float):
        method (AnalysisGeographyValidationEnvelopeDataSupportsItemPeriodsItemMethod):
        output_record_count (int):
        output_total (float):
        period (str):
    """

    input_record_count: int
    input_total: float
    method: AnalysisGeographyValidationEnvelopeDataSupportsItemPeriodsItemMethod
    output_record_count: int
    output_total: float
    period: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        input_record_count = self.input_record_count

        input_total = self.input_total

        method = self.method.value

        output_record_count = self.output_record_count

        output_total = self.output_total

        period = self.period

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "inputRecordCount": input_record_count,
                "inputTotal": input_total,
                "method": method,
                "outputRecordCount": output_record_count,
                "outputTotal": output_total,
                "period": period,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        input_record_count = d.pop("inputRecordCount")

        input_total = d.pop("inputTotal")

        method = AnalysisGeographyValidationEnvelopeDataSupportsItemPeriodsItemMethod(
            d.pop("method")
        )

        output_record_count = d.pop("outputRecordCount")

        output_total = d.pop("outputTotal")

        period = d.pop("period")

        analysis_geography_validation_envelope_data_supports_item_periods_item = cls(
            input_record_count=input_record_count,
            input_total=input_total,
            method=method,
            output_record_count=output_record_count,
            output_total=output_total,
            period=period,
        )

        analysis_geography_validation_envelope_data_supports_item_periods_item.additional_properties = d
        return analysis_geography_validation_envelope_data_supports_item_periods_item

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
