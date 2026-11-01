from __future__ import annotations

from collections.abc import Mapping
from typing import (
    TYPE_CHECKING,
    Any,
    Literal,
    Self,
    TypeVar,
    cast,
)

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.resolve_boundary_release_for_date_response_200_data_next_type_0 import (
        ResolveBoundaryReleaseForDateResponse200DataNextType0,
    )
    from ..models.resolve_boundary_release_for_date_response_200_data_not_covering_item import (
        ResolveBoundaryReleaseForDateResponse200DataNotCoveringItem,
    )
    from ..models.resolve_boundary_release_for_date_response_200_data_previous_type_0 import (
        ResolveBoundaryReleaseForDateResponse200DataPreviousType0,
    )
    from ..models.resolve_boundary_release_for_date_response_200_data_selected import (
        ResolveBoundaryReleaseForDateResponse200DataSelected,
    )
    from ..models.resolve_boundary_release_for_date_response_200_data_set_aside_item import (
        ResolveBoundaryReleaseForDateResponse200DataSetAsideItem,
    )


T = TypeVar("T", bound="ResolveBoundaryReleaseForDateResponse200Data")


@_attrs_define
class ResolveBoundaryReleaseForDateResponse200Data:
    """
    Attributes:
        basis (Literal['latest-release-dated-on-or-before']):
        date (str):
        geography (str):
        month (str):
        next_ (None | ResolveBoundaryReleaseForDateResponse200DataNextType0):
        not_covering (list[ResolveBoundaryReleaseForDateResponse200DataNotCoveringItem]):
        note (str):
        previous (None | ResolveBoundaryReleaseForDateResponse200DataPreviousType0):
        same_month (bool):
        selected (ResolveBoundaryReleaseForDateResponse200DataSelected):
        set_aside (list[ResolveBoundaryReleaseForDateResponse200DataSetAsideItem]):
        country (str | Unset):
        undated (list[str] | Unset):
    """

    basis: Literal["latest-release-dated-on-or-before"]
    date: str
    geography: str
    month: str
    next_: None | ResolveBoundaryReleaseForDateResponse200DataNextType0
    not_covering: list[ResolveBoundaryReleaseForDateResponse200DataNotCoveringItem]
    note: str
    previous: None | ResolveBoundaryReleaseForDateResponse200DataPreviousType0
    same_month: bool
    selected: ResolveBoundaryReleaseForDateResponse200DataSelected
    set_aside: list[ResolveBoundaryReleaseForDateResponse200DataSetAsideItem]
    country: str | Unset = UNSET
    undated: list[str] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.resolve_boundary_release_for_date_response_200_data_next_type_0 import (
            ResolveBoundaryReleaseForDateResponse200DataNextType0,
        )
        from ..models.resolve_boundary_release_for_date_response_200_data_previous_type_0 import (
            ResolveBoundaryReleaseForDateResponse200DataPreviousType0,
        )

        basis = self.basis

        date = self.date

        geography = self.geography

        month = self.month

        next_: dict[str, Any] | None
        if isinstance(
            self.next_, ResolveBoundaryReleaseForDateResponse200DataNextType0
        ):
            next_ = self.next_.to_dict()
        else:
            next_ = self.next_

        not_covering = []
        for not_covering_item_data in self.not_covering:
            not_covering_item = not_covering_item_data.to_dict()
            not_covering.append(not_covering_item)

        note = self.note

        previous: dict[str, Any] | None
        if isinstance(
            self.previous, ResolveBoundaryReleaseForDateResponse200DataPreviousType0
        ):
            previous = self.previous.to_dict()
        else:
            previous = self.previous

        same_month = self.same_month

        selected = self.selected.to_dict()

        set_aside = []
        for set_aside_item_data in self.set_aside:
            set_aside_item = set_aside_item_data.to_dict()
            set_aside.append(set_aside_item)

        country = self.country

        undated: list[str] | Unset = UNSET
        if not isinstance(self.undated, Unset):
            undated = self.undated

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "basis": basis,
                "date": date,
                "geography": geography,
                "month": month,
                "next": next_,
                "notCovering": not_covering,
                "note": note,
                "previous": previous,
                "sameMonth": same_month,
                "selected": selected,
                "setAside": set_aside,
            }
        )
        if country is not UNSET:
            field_dict["country"] = country
        if undated is not UNSET:
            field_dict["undated"] = undated

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.resolve_boundary_release_for_date_response_200_data_next_type_0 import (
            ResolveBoundaryReleaseForDateResponse200DataNextType0,
        )
        from ..models.resolve_boundary_release_for_date_response_200_data_not_covering_item import (
            ResolveBoundaryReleaseForDateResponse200DataNotCoveringItem,
        )
        from ..models.resolve_boundary_release_for_date_response_200_data_previous_type_0 import (
            ResolveBoundaryReleaseForDateResponse200DataPreviousType0,
        )
        from ..models.resolve_boundary_release_for_date_response_200_data_selected import (
            ResolveBoundaryReleaseForDateResponse200DataSelected,
        )
        from ..models.resolve_boundary_release_for_date_response_200_data_set_aside_item import (
            ResolveBoundaryReleaseForDateResponse200DataSetAsideItem,
        )

        d = dict(src_dict)
        basis = cast(Literal["latest-release-dated-on-or-before"], d.pop("basis"))
        if basis != "latest-release-dated-on-or-before":
            raise ValueError(
                f"basis must match const 'latest-release-dated-on-or-before', got '{basis}'"
            )

        date = d.pop("date")

        geography = d.pop("geography")

        month = d.pop("month")

        def _parse_next_(
            data: object,
        ) -> None | ResolveBoundaryReleaseForDateResponse200DataNextType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                next_type_0 = (
                    ResolveBoundaryReleaseForDateResponse200DataNextType0.from_dict(
                        data
                    )
                )

                return next_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(
                None | ResolveBoundaryReleaseForDateResponse200DataNextType0, data
            )

        next_ = _parse_next_(d.pop("next"))

        not_covering = []
        _not_covering = d.pop("notCovering")
        for not_covering_item_data in _not_covering:
            not_covering_item = (
                ResolveBoundaryReleaseForDateResponse200DataNotCoveringItem.from_dict(
                    not_covering_item_data
                )
            )

            not_covering.append(not_covering_item)

        note = d.pop("note")

        def _parse_previous(
            data: object,
        ) -> None | ResolveBoundaryReleaseForDateResponse200DataPreviousType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                previous_type_0 = (
                    ResolveBoundaryReleaseForDateResponse200DataPreviousType0.from_dict(
                        data
                    )
                )

                return previous_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(
                None | ResolveBoundaryReleaseForDateResponse200DataPreviousType0, data
            )

        previous = _parse_previous(d.pop("previous"))

        same_month = d.pop("sameMonth")

        selected = ResolveBoundaryReleaseForDateResponse200DataSelected.from_dict(
            d.pop("selected")
        )

        set_aside = []
        _set_aside = d.pop("setAside")
        for set_aside_item_data in _set_aside:
            set_aside_item = (
                ResolveBoundaryReleaseForDateResponse200DataSetAsideItem.from_dict(
                    set_aside_item_data
                )
            )

            set_aside.append(set_aside_item)

        country = d.pop("country", UNSET)

        undated = cast(list[str], d.pop("undated", UNSET))

        resolve_boundary_release_for_date_response_200_data = cls(
            basis=basis,
            date=date,
            geography=geography,
            month=month,
            next_=next_,
            not_covering=not_covering,
            note=note,
            previous=previous,
            same_month=same_month,
            selected=selected,
            set_aside=set_aside,
            country=country,
            undated=undated,
        )

        resolve_boundary_release_for_date_response_200_data.additional_properties = d
        return resolve_boundary_release_for_date_response_200_data

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
