from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.validation_report_schema_version import ValidationReportSchemaVersion

if TYPE_CHECKING:
    from ..models.validation_report_inputs import ValidationReportInputs
    from ..models.validation_report_summary import ValidationReportSummary
    from ..models.validation_resource import ValidationResource


T = TypeVar("T", bound="ValidationReport")


@_attrs_define
class ValidationReport:
    """
    Attributes:
        content_hash (str):
        inputs (ValidationReportInputs): Content hashes of the artifacts and waivers the checks read.
        resources (list[ValidationResource]):
        schema_version (ValidationReportSchemaVersion):
        summary (ValidationReportSummary):
    """

    content_hash: str
    inputs: ValidationReportInputs
    resources: list[ValidationResource]
    schema_version: ValidationReportSchemaVersion
    summary: ValidationReportSummary
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        content_hash = self.content_hash

        inputs = self.inputs.to_dict()

        resources = []
        for resources_item_data in self.resources:
            resources_item = resources_item_data.to_dict()
            resources.append(resources_item)

        schema_version = self.schema_version.value

        summary = self.summary.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "contentHash": content_hash,
                "inputs": inputs,
                "resources": resources,
                "schemaVersion": schema_version,
                "summary": summary,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.validation_report_inputs import ValidationReportInputs
        from ..models.validation_report_summary import ValidationReportSummary
        from ..models.validation_resource import ValidationResource

        d = dict(src_dict)
        content_hash = d.pop("contentHash")

        inputs = ValidationReportInputs.from_dict(d.pop("inputs"))

        resources = []
        _resources = d.pop("resources")
        for resources_item_data in _resources:
            resources_item = ValidationResource.from_dict(resources_item_data)

            resources.append(resources_item)

        schema_version = ValidationReportSchemaVersion(d.pop("schemaVersion"))

        summary = ValidationReportSummary.from_dict(d.pop("summary"))

        validation_report = cls(
            content_hash=content_hash,
            inputs=inputs,
            resources=resources,
            schema_version=schema_version,
            summary=summary,
        )

        validation_report.additional_properties = d
        return validation_report

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
