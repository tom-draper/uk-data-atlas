from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.get_measure_response_200_data_sources_item_coverage_kind import (
    GetMeasureResponse200DataSourcesItemCoverageKind,
)

T = TypeVar("T", bound="GetMeasureResponse200DataSourcesItemCoverage")


@_attrs_define
class GetMeasureResponse200DataSourcesItemCoverage:
    """
    Attributes:
        countries (list[str]):
        kind (GetMeasureResponse200DataSourcesItemCoverageKind):
        note (str):
        record_count (float):
    """

    countries: list[str]
    kind: GetMeasureResponse200DataSourcesItemCoverageKind
    note: str
    record_count: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        countries = self.countries

        kind = self.kind.value

        note = self.note

        record_count = self.record_count

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "countries": countries,
                "kind": kind,
                "note": note,
                "recordCount": record_count,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        countries = cast(list[str], d.pop("countries"))

        kind = GetMeasureResponse200DataSourcesItemCoverageKind(d.pop("kind"))

        note = d.pop("note")

        record_count = d.pop("recordCount")

        get_measure_response_200_data_sources_item_coverage = cls(
            countries=countries,
            kind=kind,
            note=note,
            record_count=record_count,
        )

        get_measure_response_200_data_sources_item_coverage.additional_properties = d
        return get_measure_response_200_data_sources_item_coverage

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
