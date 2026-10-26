from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.invalid_format_problem_code import InvalidFormatProblemCode
from ..models.invalid_format_problem_status import InvalidFormatProblemStatus
from ..models.problem_absence import ProblemAbsence
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.geometry_source import GeometrySource
    from ..models.problem_available_releases_item import ProblemAvailableReleasesItem
    from ..models.problem_candidates_item import ProblemCandidatesItem
    from ..models.problem_choices_item_type_0 import ProblemChoicesItemType0
    from ..models.problem_links import ProblemLinks
    from ..models.problem_present_in_item import ProblemPresentInItem
    from ..models.problem_rejected_item import ProblemRejectedItem


T = TypeVar("T", bound="InvalidFormatProblem")


@_attrs_define
class InvalidFormatProblem:
    """The `format` asked for is not one this route serves. Produced by `GET
    /v1/data/population?period=2022&geography=ward&codeYear=2023&format=xml`.

        Attributes:
            detail (str):
            status (InvalidFormatProblemStatus):
            title (str):
            type_ (str):
            code (InvalidFormatProblemCode): On a 404 from an area or boundary release route: `unsupported_geography` when
                the geography is not published or the release's area identities are not compiled, `unknown_release` when the
                geography has no release with that id, and `area_not_in_release` when the release does not hold the code. On a
                422 from an aggregate or a conversion: `aggregation_not_supported` when the measure's values do not add over
                areas or its weights cannot be used, `conversion_not_available` when the named crosswalk or source release
                cannot carry the partition without dropping, splitting or assuming values, and `partial_coverage` when a named
                location or a weight partition leaves out areas the sum would need. A partial country or region total is not
                refused; it is a 200 whose coverage says so. From a value request for a place: `ambiguous_place` when the name
                means several places the measure answers differently. From an observation request: `incompatible_geometry` when
                the chosen boundary release does not hold every source code. On a 400: `invalid_format` for a `format` the route
                does not serve, `invalid_cursor` for a cursor this API did not issue or that belongs to another query, and
                `unknown_query_parameter` when the operation does not declare a supplied parameter. From a release resolution:
                `no_release_for_date` and `ambiguous_release`.
            absence (ProblemAbsence | Unset): Which absence left the area or conversion unresolved. For a conversion, the
                crosswalk starts at another geography, does not map some source areas, or splits some across targets with no
                published weight. For an area, a code is `superseded` when only older releases of the geography hold it, `not-
                yet-current` when only newer ones do, `absent-from-release` when releases on both sides or undated releases hold
                it, and `unknown` when no compiled release does. The classification uses code membership only: a superseded code
                may have been abolished, merged or recoded, and none of those is claimed.
            area_count (int | Unset): With `source-areas-not-mapped` or `unweighted-split`: how many source areas the
                conversion could not carry.
            area_sample (list[str] | Unset): The first of those source area codes, at most ten.
            available_releases (list[ProblemAvailableReleasesItem] | Unset): With `unknown-release`, the releases published
                for the geography.
            candidates (list[ProblemCandidatesItem] | Unset): On a 422 Place Not Served: each place the name matched, and
                why the measure does not answer it.
            choices (list[ProblemChoicesItemType0 | str] | Unset): On a 409 Ambiguous Place: each place the name could mean,
                with its answer and the request that asks about it alone, as an object. On a refusal from an area's children
                routes: each release the children are published in, as a `{geography}/{release}` string.
            geometry_source (GeometrySource | Unset): Where the served WGS84 geometry came from. `transformation` is present
                only when the source was reprojected. Per-area compiled geometry carries `validity`; release-wide provenance and
                direct source reads omit it.
            links (ProblemLinks | Unset): With `unknown-geography`, the geography list; with `release-not-compiled`, the
                boundary release.
            parameter (str | Unset): The query parameter the operation does not declare.
            present_in (list[ProblemPresentInItem] | Unset): With `area_not_in_release`: the compiled releases that do hold
                the code, with the name it carries in each.
            rejected (list[ProblemRejectedItem] | Unset): The first rejected rows in input order. No conversion was applied.
            rejected_count (int | Unset): Total rejected input rows for supplied-count conversion.
            suggestion (str | Unset): The closest declared query parameter, when one is unambiguous.
    """

    detail: str
    status: InvalidFormatProblemStatus
    title: str
    type_: str
    code: InvalidFormatProblemCode
    absence: ProblemAbsence | Unset = UNSET
    area_count: int | Unset = UNSET
    area_sample: list[str] | Unset = UNSET
    available_releases: list[ProblemAvailableReleasesItem] | Unset = UNSET
    candidates: list[ProblemCandidatesItem] | Unset = UNSET
    choices: list[ProblemChoicesItemType0 | str] | Unset = UNSET
    geometry_source: GeometrySource | Unset = UNSET
    links: ProblemLinks | Unset = UNSET
    parameter: str | Unset = UNSET
    present_in: list[ProblemPresentInItem] | Unset = UNSET
    rejected: list[ProblemRejectedItem] | Unset = UNSET
    rejected_count: int | Unset = UNSET
    suggestion: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.problem_choices_item_type_0 import ProblemChoicesItemType0

        detail = self.detail

        status = self.status.value

        title = self.title

        type_ = self.type_

        code = self.code.value

        absence: str | Unset = UNSET
        if not isinstance(self.absence, Unset):
            absence = self.absence.value

        area_count = self.area_count

        area_sample: list[str] | Unset = UNSET
        if not isinstance(self.area_sample, Unset):
            area_sample = self.area_sample

        available_releases: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.available_releases, Unset):
            available_releases = []
            for available_releases_item_data in self.available_releases:
                available_releases_item = available_releases_item_data.to_dict()
                available_releases.append(available_releases_item)

        candidates: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.candidates, Unset):
            candidates = []
            for candidates_item_data in self.candidates:
                candidates_item = candidates_item_data.to_dict()
                candidates.append(candidates_item)

        choices: list[dict[str, Any] | str] | Unset = UNSET
        if not isinstance(self.choices, Unset):
            choices = []
            for choices_item_data in self.choices:
                choices_item: dict[str, Any] | str
                if isinstance(choices_item_data, ProblemChoicesItemType0):
                    choices_item = choices_item_data.to_dict()
                else:
                    choices_item = choices_item_data
                choices.append(choices_item)

        geometry_source: dict[str, Any] | Unset = UNSET
        if not isinstance(self.geometry_source, Unset):
            geometry_source = self.geometry_source.to_dict()

        links: dict[str, Any] | Unset = UNSET
        if not isinstance(self.links, Unset):
            links = self.links.to_dict()

        parameter = self.parameter

        present_in: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.present_in, Unset):
            present_in = []
            for present_in_item_data in self.present_in:
                present_in_item = present_in_item_data.to_dict()
                present_in.append(present_in_item)

        rejected: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.rejected, Unset):
            rejected = []
            for rejected_item_data in self.rejected:
                rejected_item = rejected_item_data.to_dict()
                rejected.append(rejected_item)

        rejected_count = self.rejected_count

        suggestion = self.suggestion

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "detail": detail,
                "status": status,
                "title": title,
                "type": type_,
                "code": code,
            }
        )
        if absence is not UNSET:
            field_dict["absence"] = absence
        if area_count is not UNSET:
            field_dict["areaCount"] = area_count
        if area_sample is not UNSET:
            field_dict["areaSample"] = area_sample
        if available_releases is not UNSET:
            field_dict["availableReleases"] = available_releases
        if candidates is not UNSET:
            field_dict["candidates"] = candidates
        if choices is not UNSET:
            field_dict["choices"] = choices
        if geometry_source is not UNSET:
            field_dict["geometrySource"] = geometry_source
        if links is not UNSET:
            field_dict["links"] = links
        if parameter is not UNSET:
            field_dict["parameter"] = parameter
        if present_in is not UNSET:
            field_dict["presentIn"] = present_in
        if rejected is not UNSET:
            field_dict["rejected"] = rejected
        if rejected_count is not UNSET:
            field_dict["rejectedCount"] = rejected_count
        if suggestion is not UNSET:
            field_dict["suggestion"] = suggestion

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.geometry_source import GeometrySource
        from ..models.problem_available_releases_item import (
            ProblemAvailableReleasesItem,
        )
        from ..models.problem_candidates_item import ProblemCandidatesItem
        from ..models.problem_choices_item_type_0 import ProblemChoicesItemType0
        from ..models.problem_links import ProblemLinks
        from ..models.problem_present_in_item import ProblemPresentInItem
        from ..models.problem_rejected_item import ProblemRejectedItem

        d = dict(src_dict)
        detail = d.pop("detail")

        status = InvalidFormatProblemStatus(d.pop("status"))

        title = d.pop("title")

        type_ = d.pop("type")

        code = InvalidFormatProblemCode(d.pop("code"))

        _absence = d.pop("absence", UNSET)
        absence: ProblemAbsence | Unset
        if isinstance(_absence, Unset):
            absence = UNSET
        else:
            absence = ProblemAbsence(_absence)

        area_count = d.pop("areaCount", UNSET)

        area_sample = cast(list[str], d.pop("areaSample", UNSET))

        _available_releases = d.pop("availableReleases", UNSET)
        available_releases: list[ProblemAvailableReleasesItem] | Unset = UNSET
        if _available_releases is not UNSET:
            available_releases = []
            for available_releases_item_data in _available_releases:
                available_releases_item = ProblemAvailableReleasesItem.from_dict(
                    available_releases_item_data
                )

                available_releases.append(available_releases_item)

        _candidates = d.pop("candidates", UNSET)
        candidates: list[ProblemCandidatesItem] | Unset = UNSET
        if _candidates is not UNSET:
            candidates = []
            for candidates_item_data in _candidates:
                candidates_item = ProblemCandidatesItem.from_dict(candidates_item_data)

                candidates.append(candidates_item)

        _choices = d.pop("choices", UNSET)
        choices: list[ProblemChoicesItemType0 | str] | Unset = UNSET
        if _choices is not UNSET:
            choices = []
            for choices_item_data in _choices:

                def _parse_choices_item(data: object) -> ProblemChoicesItemType0 | str:
                    try:
                        if not isinstance(data, dict):
                            raise TypeError()
                        choices_item_type_0 = ProblemChoicesItemType0.from_dict(data)

                        return choices_item_type_0
                    except (TypeError, ValueError, AttributeError, KeyError):
                        pass
                    return cast(ProblemChoicesItemType0 | str, data)

                choices_item = _parse_choices_item(choices_item_data)

                choices.append(choices_item)

        _geometry_source = d.pop("geometrySource", UNSET)
        geometry_source: GeometrySource | Unset
        if isinstance(_geometry_source, Unset):
            geometry_source = UNSET
        else:
            geometry_source = GeometrySource.from_dict(_geometry_source)

        _links = d.pop("links", UNSET)
        links: ProblemLinks | Unset
        if isinstance(_links, Unset):
            links = UNSET
        else:
            links = ProblemLinks.from_dict(_links)

        parameter = d.pop("parameter", UNSET)

        _present_in = d.pop("presentIn", UNSET)
        present_in: list[ProblemPresentInItem] | Unset = UNSET
        if _present_in is not UNSET:
            present_in = []
            for present_in_item_data in _present_in:
                present_in_item = ProblemPresentInItem.from_dict(present_in_item_data)

                present_in.append(present_in_item)

        _rejected = d.pop("rejected", UNSET)
        rejected: list[ProblemRejectedItem] | Unset = UNSET
        if _rejected is not UNSET:
            rejected = []
            for rejected_item_data in _rejected:
                rejected_item = ProblemRejectedItem.from_dict(rejected_item_data)

                rejected.append(rejected_item)

        rejected_count = d.pop("rejectedCount", UNSET)

        suggestion = d.pop("suggestion", UNSET)

        invalid_format_problem = cls(
            detail=detail,
            status=status,
            title=title,
            type_=type_,
            code=code,
            absence=absence,
            area_count=area_count,
            area_sample=area_sample,
            available_releases=available_releases,
            candidates=candidates,
            choices=choices,
            geometry_source=geometry_source,
            links=links,
            parameter=parameter,
            present_in=present_in,
            rejected=rejected,
            rejected_count=rejected_count,
            suggestion=suggestion,
        )

        invalid_format_problem.additional_properties = d
        return invalid_format_problem

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
