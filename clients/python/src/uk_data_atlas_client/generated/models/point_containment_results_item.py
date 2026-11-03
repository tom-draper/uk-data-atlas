from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.point_lookup_result_reason import PointLookupResultReason
from ..models.point_lookup_result_status import PointLookupResultStatus
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.geometry_source import GeometrySource
    from ..models.point_lookup_release_boundary_resolution import (
        PointLookupReleaseBoundaryResolution,
    )
    from ..models.point_lookup_release_coverage import PointLookupReleaseCoverage
    from ..models.point_lookup_release_selection import PointLookupReleaseSelection
    from ..models.point_lookup_release_source import PointLookupReleaseSource
    from ..models.point_lookup_result_matches_item import PointLookupResultMatchesItem
    from ..models.release_reference import ReleaseReference


T = TypeVar("T", bound="PointContainmentResultsItem")


@_attrs_define
class PointContainmentResultsItem:
    """
    Attributes:
        geography (str):
        selection (PointLookupReleaseSelection):
        status (PointLookupResultStatus): `ambiguous-release`, `no-release-for-date` or `geometry-unavailable` when no
            release could be read. The schema this is combined with lists every status a result may carry.
        matches (list[PointLookupResultMatchesItem]):
        boundary_release (str | Unset):
        boundary_resolution (PointLookupReleaseBoundaryResolution | Unset): How much the boundary's lines were
            generalised, read from the ONS release name. `undeclared` where the name does not say.
        choices (list[ReleaseReference] | Unset):
        coverage (PointLookupReleaseCoverage | Unset):
        detail (str | Unset):
        earliest (ReleaseReference | Unset):
        geometry_source (GeometrySource | Unset): Where the served WGS84 geometry came from. `transformation` is present
            only when the source was reprojected. Per-area compiled geometry carries `validity`; release-wide provenance and
            direct source reads omit it.
        href (str | Unset):
        source (PointLookupReleaseSource | Unset):
        positional_tolerance_m (float | Unset): Coordinate uncertainty, boundary generalisation and transformation
            accuracy added together, in metres.
        reason (PointLookupResultReason | Unset):
    """

    geography: str
    selection: PointLookupReleaseSelection
    status: PointLookupResultStatus
    matches: list[PointLookupResultMatchesItem]
    boundary_release: str | Unset = UNSET
    boundary_resolution: PointLookupReleaseBoundaryResolution | Unset = UNSET
    choices: list[ReleaseReference] | Unset = UNSET
    coverage: PointLookupReleaseCoverage | Unset = UNSET
    detail: str | Unset = UNSET
    earliest: ReleaseReference | Unset = UNSET
    geometry_source: GeometrySource | Unset = UNSET
    href: str | Unset = UNSET
    source: PointLookupReleaseSource | Unset = UNSET
    positional_tolerance_m: float | Unset = UNSET
    reason: PointLookupResultReason | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        geography = self.geography

        selection = self.selection.to_dict()

        status = self.status.value

        matches = []
        for matches_item_data in self.matches:
            matches_item = matches_item_data.to_dict()
            matches.append(matches_item)

        boundary_release = self.boundary_release

        boundary_resolution: dict[str, Any] | Unset = UNSET
        if not isinstance(self.boundary_resolution, Unset):
            boundary_resolution = self.boundary_resolution.to_dict()

        choices: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.choices, Unset):
            choices = []
            for choices_item_data in self.choices:
                choices_item = choices_item_data.to_dict()
                choices.append(choices_item)

        coverage: dict[str, Any] | Unset = UNSET
        if not isinstance(self.coverage, Unset):
            coverage = self.coverage.to_dict()

        detail = self.detail

        earliest: dict[str, Any] | Unset = UNSET
        if not isinstance(self.earliest, Unset):
            earliest = self.earliest.to_dict()

        geometry_source: dict[str, Any] | Unset = UNSET
        if not isinstance(self.geometry_source, Unset):
            geometry_source = self.geometry_source.to_dict()

        href = self.href

        source: dict[str, Any] | Unset = UNSET
        if not isinstance(self.source, Unset):
            source = self.source.to_dict()

        positional_tolerance_m = self.positional_tolerance_m

        reason: str | Unset = UNSET
        if not isinstance(self.reason, Unset):
            reason = self.reason.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "geography": geography,
                "selection": selection,
                "status": status,
                "matches": matches,
            }
        )
        if boundary_release is not UNSET:
            field_dict["boundaryRelease"] = boundary_release
        if boundary_resolution is not UNSET:
            field_dict["boundaryResolution"] = boundary_resolution
        if choices is not UNSET:
            field_dict["choices"] = choices
        if coverage is not UNSET:
            field_dict["coverage"] = coverage
        if detail is not UNSET:
            field_dict["detail"] = detail
        if earliest is not UNSET:
            field_dict["earliest"] = earliest
        if geometry_source is not UNSET:
            field_dict["geometrySource"] = geometry_source
        if href is not UNSET:
            field_dict["href"] = href
        if source is not UNSET:
            field_dict["source"] = source
        if positional_tolerance_m is not UNSET:
            field_dict["positionalToleranceM"] = positional_tolerance_m
        if reason is not UNSET:
            field_dict["reason"] = reason

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.geometry_source import GeometrySource
        from ..models.point_lookup_release_boundary_resolution import (
            PointLookupReleaseBoundaryResolution,
        )
        from ..models.point_lookup_release_coverage import PointLookupReleaseCoverage
        from ..models.point_lookup_release_selection import PointLookupReleaseSelection
        from ..models.point_lookup_release_source import PointLookupReleaseSource
        from ..models.point_lookup_result_matches_item import (
            PointLookupResultMatchesItem,
        )
        from ..models.release_reference import ReleaseReference

        d = dict(src_dict)
        geography = d.pop("geography")

        selection = PointLookupReleaseSelection.from_dict(d.pop("selection"))

        status = PointLookupResultStatus(d.pop("status"))

        matches = []
        _matches = d.pop("matches")
        for matches_item_data in _matches:
            matches_item = PointLookupResultMatchesItem.from_dict(matches_item_data)

            matches.append(matches_item)

        boundary_release = d.pop("boundaryRelease", UNSET)

        _boundary_resolution = d.pop("boundaryResolution", UNSET)
        boundary_resolution: PointLookupReleaseBoundaryResolution | Unset
        if isinstance(_boundary_resolution, Unset):
            boundary_resolution = UNSET
        else:
            boundary_resolution = PointLookupReleaseBoundaryResolution.from_dict(
                _boundary_resolution
            )

        _choices = d.pop("choices", UNSET)
        choices: list[ReleaseReference] | Unset = UNSET
        if _choices is not UNSET:
            choices = []
            for choices_item_data in _choices:
                choices_item = ReleaseReference.from_dict(choices_item_data)

                choices.append(choices_item)

        _coverage = d.pop("coverage", UNSET)
        coverage: PointLookupReleaseCoverage | Unset
        if isinstance(_coverage, Unset):
            coverage = UNSET
        else:
            coverage = PointLookupReleaseCoverage.from_dict(_coverage)

        detail = d.pop("detail", UNSET)

        _earliest = d.pop("earliest", UNSET)
        earliest: ReleaseReference | Unset
        if isinstance(_earliest, Unset):
            earliest = UNSET
        else:
            earliest = ReleaseReference.from_dict(_earliest)

        _geometry_source = d.pop("geometrySource", UNSET)
        geometry_source: GeometrySource | Unset
        if isinstance(_geometry_source, Unset):
            geometry_source = UNSET
        else:
            geometry_source = GeometrySource.from_dict(_geometry_source)

        href = d.pop("href", UNSET)

        _source = d.pop("source", UNSET)
        source: PointLookupReleaseSource | Unset
        if isinstance(_source, Unset):
            source = UNSET
        else:
            source = PointLookupReleaseSource.from_dict(_source)

        positional_tolerance_m = d.pop("positionalToleranceM", UNSET)

        _reason = d.pop("reason", UNSET)
        reason: PointLookupResultReason | Unset
        if isinstance(_reason, Unset):
            reason = UNSET
        else:
            reason = PointLookupResultReason(_reason)

        point_containment_results_item = cls(
            geography=geography,
            selection=selection,
            status=status,
            matches=matches,
            boundary_release=boundary_release,
            boundary_resolution=boundary_resolution,
            choices=choices,
            coverage=coverage,
            detail=detail,
            earliest=earliest,
            geometry_source=geometry_source,
            href=href,
            source=source,
            positional_tolerance_m=positional_tolerance_m,
            reason=reason,
        )

        point_containment_results_item.additional_properties = d
        return point_containment_results_item

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
