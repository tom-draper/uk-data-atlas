from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.supplied_count_conversion_envelope_data_records_item_status import (
    SuppliedCountConversionEnvelopeDataRecordsItemStatus,
)

if TYPE_CHECKING:
    from ..models.supplied_count_conversion_envelope_data_records_item_coverage import (
        SuppliedCountConversionEnvelopeDataRecordsItemCoverage,
    )


T = TypeVar("T", bound="SuppliedCountConversionEnvelopeDataRecordsItem")


@_attrs_define
class SuppliedCountConversionEnvelopeDataRecordsItem:
    """
    Attributes:
        area_code (str):
        coverage (SuppliedCountConversionEnvelopeDataRecordsItemCoverage):
        input_area_count (int):
        status (SuppliedCountConversionEnvelopeDataRecordsItemStatus):
        value (float):
    """

    area_code: str
    coverage: SuppliedCountConversionEnvelopeDataRecordsItemCoverage
    input_area_count: int
    status: SuppliedCountConversionEnvelopeDataRecordsItemStatus
    value: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        area_code = self.area_code

        coverage = self.coverage.to_dict()

        input_area_count = self.input_area_count

        status = self.status.value

        value = self.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "areaCode": area_code,
                "coverage": coverage,
                "inputAreaCount": input_area_count,
                "status": status,
                "value": value,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.supplied_count_conversion_envelope_data_records_item_coverage import (
            SuppliedCountConversionEnvelopeDataRecordsItemCoverage,
        )

        d = dict(src_dict)
        area_code = d.pop("areaCode")

        coverage = SuppliedCountConversionEnvelopeDataRecordsItemCoverage.from_dict(
            d.pop("coverage")
        )

        input_area_count = d.pop("inputAreaCount")

        status = SuppliedCountConversionEnvelopeDataRecordsItemStatus(d.pop("status"))

        value = d.pop("value")

        supplied_count_conversion_envelope_data_records_item = cls(
            area_code=area_code,
            coverage=coverage,
            input_area_count=input_area_count,
            status=status,
            value=value,
        )

        supplied_count_conversion_envelope_data_records_item.additional_properties = d
        return supplied_count_conversion_envelope_data_records_item

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
