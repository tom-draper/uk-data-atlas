from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.point_lookup_release_selection_policy import (
    PointLookupReleaseSelectionPolicy,
)
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.release_reference import ReleaseReference


T = TypeVar("T", bound="PointLookupReleaseSelection")


@_attrs_define
class PointLookupReleaseSelection:
    """
    Attributes:
        policy (PointLookupReleaseSelectionPolicy):
        date (str | Unset):
        next_ (None | ReleaseReference | Unset):
        same_month (bool | Unset):
    """

    policy: PointLookupReleaseSelectionPolicy
    date: str | Unset = UNSET
    next_: None | ReleaseReference | Unset = UNSET
    same_month: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.release_reference import ReleaseReference

        policy = self.policy.value

        date = self.date

        next_: dict[str, Any] | None | Unset
        if isinstance(self.next_, Unset):
            next_ = UNSET
        elif isinstance(self.next_, ReleaseReference):
            next_ = self.next_.to_dict()
        else:
            next_ = self.next_

        same_month = self.same_month

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "policy": policy,
            }
        )
        if date is not UNSET:
            field_dict["date"] = date
        if next_ is not UNSET:
            field_dict["next"] = next_
        if same_month is not UNSET:
            field_dict["sameMonth"] = same_month

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.release_reference import ReleaseReference

        d = dict(src_dict)
        policy = PointLookupReleaseSelectionPolicy(d.pop("policy"))

        date = d.pop("date", UNSET)

        def _parse_next_(data: object) -> None | ReleaseReference | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                next_type_0 = ReleaseReference.from_dict(data)

                return next_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | ReleaseReference | Unset, data)

        next_ = _parse_next_(d.pop("next", UNSET))

        same_month = d.pop("sameMonth", UNSET)

        point_lookup_release_selection = cls(
            policy=policy,
            date=date,
            next_=next_,
            same_month=same_month,
        )

        point_lookup_release_selection.additional_properties = d
        return point_lookup_release_selection

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
