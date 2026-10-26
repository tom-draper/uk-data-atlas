from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="AnalysisSource")


@_attrs_define
class AnalysisSource:
    """
    Attributes:
        code_year (int):
        dataset_id (str):
        geography (str):
        periods (list[str]):
    """

    code_year: int
    dataset_id: str
    geography: str
    periods: list[str]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        code_year = self.code_year

        dataset_id = self.dataset_id

        geography = self.geography

        periods = self.periods

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "codeYear": code_year,
                "datasetId": dataset_id,
                "geography": geography,
                "periods": periods,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        code_year = d.pop("codeYear")

        dataset_id = d.pop("datasetId")

        geography = d.pop("geography")

        periods = cast(list[str], d.pop("periods"))

        analysis_source = cls(
            code_year=code_year,
            dataset_id=dataset_id,
            geography=geography,
            periods=periods,
        )

        analysis_source.additional_properties = d
        return analysis_source

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
