from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.supplied_count_conversion_envelope_data_coverage_scope import (
    SuppliedCountConversionEnvelopeDataCoverageScope,
)
from ..types import UNSET, Unset

T = TypeVar("T", bound="SuppliedCountConversionEnvelopeDataCoverage")


@_attrs_define
class SuppliedCountConversionEnvelopeDataCoverage:
    """
    Attributes:
        crosswalk_source_areas (int):
        scope (SuppliedCountConversionEnvelopeDataCoverageScope):
        source_areas_supplied (int):
        targets_complete (int):
        targets_not_reached (int):
        targets_partial (int):
        source_areas (int | Unset):
    """

    crosswalk_source_areas: int
    scope: SuppliedCountConversionEnvelopeDataCoverageScope
    source_areas_supplied: int
    targets_complete: int
    targets_not_reached: int
    targets_partial: int
    source_areas: int | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        crosswalk_source_areas = self.crosswalk_source_areas

        scope = self.scope.value

        source_areas_supplied = self.source_areas_supplied

        targets_complete = self.targets_complete

        targets_not_reached = self.targets_not_reached

        targets_partial = self.targets_partial

        source_areas = self.source_areas

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "crosswalkSourceAreas": crosswalk_source_areas,
                "scope": scope,
                "sourceAreasSupplied": source_areas_supplied,
                "targetsComplete": targets_complete,
                "targetsNotReached": targets_not_reached,
                "targetsPartial": targets_partial,
            }
        )
        if source_areas is not UNSET:
            field_dict["sourceAreas"] = source_areas

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        crosswalk_source_areas = d.pop("crosswalkSourceAreas")

        scope = SuppliedCountConversionEnvelopeDataCoverageScope(d.pop("scope"))

        source_areas_supplied = d.pop("sourceAreasSupplied")

        targets_complete = d.pop("targetsComplete")

        targets_not_reached = d.pop("targetsNotReached")

        targets_partial = d.pop("targetsPartial")

        source_areas = d.pop("sourceAreas", UNSET)

        supplied_count_conversion_envelope_data_coverage = cls(
            crosswalk_source_areas=crosswalk_source_areas,
            scope=scope,
            source_areas_supplied=source_areas_supplied,
            targets_complete=targets_complete,
            targets_not_reached=targets_not_reached,
            targets_partial=targets_partial,
            source_areas=source_areas,
        )

        supplied_count_conversion_envelope_data_coverage.additional_properties = d
        return supplied_count_conversion_envelope_data_coverage

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
