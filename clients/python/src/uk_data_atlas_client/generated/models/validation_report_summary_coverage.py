from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="ValidationReportSummaryCoverage")


@_attrs_define
class ValidationReportSummaryCoverage:
    """How many boundary releases each capability reaches. servableGeometry counts releases with servable geometry for at
    least some areas; their geometry-servable checks name any areas refused. measures and measureSources count the
    checked measures and their source partitions.

        Attributes:
            area_identities (int):
            boundary_releases (int):
            crosswalks (int):
            measure_sources (int):
            measures (int):
            servable_geometry (int):
            weighted_crosswalks (int):
            with_relationships (int):
    """

    area_identities: int
    boundary_releases: int
    crosswalks: int
    measure_sources: int
    measures: int
    servable_geometry: int
    weighted_crosswalks: int
    with_relationships: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        area_identities = self.area_identities

        boundary_releases = self.boundary_releases

        crosswalks = self.crosswalks

        measure_sources = self.measure_sources

        measures = self.measures

        servable_geometry = self.servable_geometry

        weighted_crosswalks = self.weighted_crosswalks

        with_relationships = self.with_relationships

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "areaIdentities": area_identities,
                "boundaryReleases": boundary_releases,
                "crosswalks": crosswalks,
                "measureSources": measure_sources,
                "measures": measures,
                "servableGeometry": servable_geometry,
                "weightedCrosswalks": weighted_crosswalks,
                "withRelationships": with_relationships,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        area_identities = d.pop("areaIdentities")

        boundary_releases = d.pop("boundaryReleases")

        crosswalks = d.pop("crosswalks")

        measure_sources = d.pop("measureSources")

        measures = d.pop("measures")

        servable_geometry = d.pop("servableGeometry")

        weighted_crosswalks = d.pop("weightedCrosswalks")

        with_relationships = d.pop("withRelationships")

        validation_report_summary_coverage = cls(
            area_identities=area_identities,
            boundary_releases=boundary_releases,
            crosswalks=crosswalks,
            measure_sources=measure_sources,
            measures=measures,
            servable_geometry=servable_geometry,
            weighted_crosswalks=weighted_crosswalks,
            with_relationships=with_relationships,
        )

        validation_report_summary_coverage.additional_properties = d
        return validation_report_summary_coverage

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
