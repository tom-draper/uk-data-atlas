from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.validation_report_summary_coverage import (
        ValidationReportSummaryCoverage,
    )


T = TypeVar("T", bound="ValidationReportSummary")


@_attrs_define
class ValidationReportSummary:
    """
    Attributes:
        check_count (int):
        coverage (ValidationReportSummaryCoverage): How many boundary releases each capability reaches. servableGeometry
            counts releases with servable geometry for at least some areas; their geometry-servable checks name any areas
            refused. measures and measureSources count the checked measures and their source partitions.
        passed_count (int):
        resource_count (int):
        waived_count (int):
    """

    check_count: int
    coverage: ValidationReportSummaryCoverage
    passed_count: int
    resource_count: int
    waived_count: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        check_count = self.check_count

        coverage = self.coverage.to_dict()

        passed_count = self.passed_count

        resource_count = self.resource_count

        waived_count = self.waived_count

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "checkCount": check_count,
                "coverage": coverage,
                "passedCount": passed_count,
                "resourceCount": resource_count,
                "waivedCount": waived_count,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.validation_report_summary_coverage import (
            ValidationReportSummaryCoverage,
        )

        d = dict(src_dict)
        check_count = d.pop("checkCount")

        coverage = ValidationReportSummaryCoverage.from_dict(d.pop("coverage"))

        passed_count = d.pop("passedCount")

        resource_count = d.pop("resourceCount")

        waived_count = d.pop("waivedCount")

        validation_report_summary = cls(
            check_count=check_count,
            coverage=coverage,
            passed_count=passed_count,
            resource_count=resource_count,
            waived_count=waived_count,
        )

        validation_report_summary.additional_properties = d
        return validation_report_summary

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
