from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.nearest_areas_results_item_status import NearestAreasResultsItemStatus
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.geometry_source import GeometrySource
    from ..models.nearest_areas_results_item_nearest_item import (
        NearestAreasResultsItemNearestItem,
    )
    from ..models.point_lookup_release_boundary_resolution import (
        PointLookupReleaseBoundaryResolution,
    )
    from ..models.point_lookup_release_coverage import PointLookupReleaseCoverage
    from ..models.point_lookup_release_selection import PointLookupReleaseSelection
    from ..models.point_lookup_release_source import PointLookupReleaseSource
    from ..models.release_reference import ReleaseReference


T = TypeVar("T", bound="NearestAreasResultsItem")


@_attrs_define
class NearestAreasResultsItem:
    """
    Attributes:
        geography (str):
        selection (PointLookupReleaseSelection):
        nearest (list[NearestAreasResultsItemNearestItem]):
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
        status (NearestAreasResultsItemStatus | Unset): `ambiguous-release`, `no-release-for-date` or `geometry-
            unavailable` when no release could be read. The schema this is combined with lists every status a result may
            carry.
        matched (int | Unset):
        truncated (bool | Unset):
    """

    geography: str
    selection: PointLookupReleaseSelection
    nearest: list[NearestAreasResultsItemNearestItem]
    boundary_release: str | Unset = UNSET
    boundary_resolution: PointLookupReleaseBoundaryResolution | Unset = UNSET
    choices: list[ReleaseReference] | Unset = UNSET
    coverage: PointLookupReleaseCoverage | Unset = UNSET
    detail: str | Unset = UNSET
    earliest: ReleaseReference | Unset = UNSET
    geometry_source: GeometrySource | Unset = UNSET
    href: str | Unset = UNSET
    source: PointLookupReleaseSource | Unset = UNSET
    status: NearestAreasResultsItemStatus | Unset = UNSET
    matched: int | Unset = UNSET
    truncated: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        geography = self.geography

        selection = self.selection.to_dict()

        nearest = []
        for nearest_item_data in self.nearest:
            nearest_item = nearest_item_data.to_dict()
            nearest.append(nearest_item)

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

        status: str | Unset = UNSET
        if not isinstance(self.status, Unset):
            status = self.status.value

        matched = self.matched

        truncated = self.truncated

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "geography": geography,
                "selection": selection,
                "nearest": nearest,
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
        if status is not UNSET:
            field_dict["status"] = status
        if matched is not UNSET:
            field_dict["matched"] = matched
        if truncated is not UNSET:
            field_dict["truncated"] = truncated

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.geometry_source import GeometrySource
        from ..models.nearest_areas_results_item_nearest_item import (
            NearestAreasResultsItemNearestItem,
        )
        from ..models.point_lookup_release_boundary_resolution import (
            PointLookupReleaseBoundaryResolution,
        )
        from ..models.point_lookup_release_coverage import PointLookupReleaseCoverage
        from ..models.point_lookup_release_selection import PointLookupReleaseSelection
        from ..models.point_lookup_release_source import PointLookupReleaseSource
        from ..models.release_reference import ReleaseReference

        d = dict(src_dict)
        geography = d.pop("geography")

        selection = PointLookupReleaseSelection.from_dict(d.pop("selection"))

        nearest = []
        _nearest = d.pop("nearest")
        for nearest_item_data in _nearest:
            nearest_item = NearestAreasResultsItemNearestItem.from_dict(
                nearest_item_data
            )

            nearest.append(nearest_item)

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

        _status = d.pop("status", UNSET)
        status: NearestAreasResultsItemStatus | Unset
        if isinstance(_status, Unset):
            status = UNSET
        else:
            status = NearestAreasResultsItemStatus(_status)

        matched = d.pop("matched", UNSET)

        truncated = d.pop("truncated", UNSET)

        nearest_areas_results_item = cls(
            geography=geography,
            selection=selection,
            nearest=nearest,
            boundary_release=boundary_release,
            boundary_resolution=boundary_resolution,
            choices=choices,
            coverage=coverage,
            detail=detail,
            earliest=earliest,
            geometry_source=geometry_source,
            href=href,
            source=source,
            status=status,
            matched=matched,
            truncated=truncated,
        )

        nearest_areas_results_item.additional_properties = d
        return nearest_areas_results_item

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
