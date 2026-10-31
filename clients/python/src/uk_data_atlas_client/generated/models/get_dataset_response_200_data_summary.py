from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="GetDatasetResponse200DataSummary")


@_attrs_define
class GetDatasetResponse200DataSummary:
    """
    Attributes:
        code_years (list[float]):
        data_record_count (float):
        dataset_count (float):
    """

    code_years: list[float]
    data_record_count: float
    dataset_count: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        code_years = self.code_years

        data_record_count = self.data_record_count

        dataset_count = self.dataset_count

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "codeYears": code_years,
                "dataRecordCount": data_record_count,
                "datasetCount": dataset_count,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        code_years = cast(list[float], d.pop("codeYears"))

        data_record_count = d.pop("dataRecordCount")

        dataset_count = d.pop("datasetCount")

        get_dataset_response_200_data_summary = cls(
            code_years=code_years,
            data_record_count=data_record_count,
            dataset_count=dataset_count,
        )

        get_dataset_response_200_data_summary.additional_properties = d
        return get_dataset_response_200_data_summary

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
