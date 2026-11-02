from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.supplied_count_conversion_envelope_data_records_item_coverage_status import (
    SuppliedCountConversionEnvelopeDataRecordsItemCoverageStatus,
)

T = TypeVar("T", bound="SuppliedCountConversionEnvelopeDataRecordsItemCoverage")


@_attrs_define
class SuppliedCountConversionEnvelopeDataRecordsItemCoverage:
    """
    Attributes:
        source_count (int):
        status (SuppliedCountConversionEnvelopeDataRecordsItemCoverageStatus):
        supplied_source_count (int):
    """

    source_count: int
    status: SuppliedCountConversionEnvelopeDataRecordsItemCoverageStatus
    supplied_source_count: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        source_count = self.source_count

        status = self.status.value

        supplied_source_count = self.supplied_source_count

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "sourceCount": source_count,
                "status": status,
                "suppliedSourceCount": supplied_source_count,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        source_count = d.pop("sourceCount")

        status = SuppliedCountConversionEnvelopeDataRecordsItemCoverageStatus(
            d.pop("status")
        )

        supplied_source_count = d.pop("suppliedSourceCount")

        supplied_count_conversion_envelope_data_records_item_coverage = cls(
            source_count=source_count,
            status=status,
            supplied_source_count=supplied_source_count,
        )

        supplied_count_conversion_envelope_data_records_item_coverage.additional_properties = d
        return supplied_count_conversion_envelope_data_records_item_coverage

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
