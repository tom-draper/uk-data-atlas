from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.point_country_code_type_1 import PointCountryCodeType1
from ..models.point_country_code_type_2_type_1 import PointCountryCodeType2Type1
from ..models.point_country_code_type_3_type_1 import PointCountryCodeType3Type1
from ..models.point_country_determined_by import PointCountryDeterminedBy
from ..types import UNSET, Unset

T = TypeVar("T", bound="PointCountry")


@_attrs_define
class PointCountry:
    """The UK country the point lies in. `area-code` reads it from a matched area's GSS code; `country-boundary` tests the
    point against a country release, and a null `code` there means no UK country contains it.

        Attributes:
            code (None | PointCountryCodeType1 | PointCountryCodeType2Type1 | PointCountryCodeType3Type1):
            determined_by (PointCountryDeterminedBy):
            area (str | Unset):
            boundary_release (str | Unset):
            detail (str | Unset):
    """

    code: (
        None
        | PointCountryCodeType1
        | PointCountryCodeType2Type1
        | PointCountryCodeType3Type1
    )
    determined_by: PointCountryDeterminedBy
    area: str | Unset = UNSET
    boundary_release: str | Unset = UNSET
    detail: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        code: None | str
        if (
            isinstance(self.code, PointCountryCodeType1)
            or isinstance(self.code, PointCountryCodeType2Type1)
            or isinstance(self.code, PointCountryCodeType3Type1)
        ):
            code = self.code.value
        else:
            code = self.code

        determined_by = self.determined_by.value

        area = self.area

        boundary_release = self.boundary_release

        detail = self.detail

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "code": code,
                "determinedBy": determined_by,
            }
        )
        if area is not UNSET:
            field_dict["area"] = area
        if boundary_release is not UNSET:
            field_dict["boundaryRelease"] = boundary_release
        if detail is not UNSET:
            field_dict["detail"] = detail

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)

        def _parse_code(
            data: object,
        ) -> (
            None
            | PointCountryCodeType1
            | PointCountryCodeType2Type1
            | PointCountryCodeType3Type1
        ):
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                code_type_1 = PointCountryCodeType1(data)

                return code_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                code_type_2_type_1 = PointCountryCodeType2Type1(data)

                return code_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                code_type_3_type_1 = PointCountryCodeType3Type1(data)

                return code_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(
                None
                | PointCountryCodeType1
                | PointCountryCodeType2Type1
                | PointCountryCodeType3Type1,
                data,
            )

        code = _parse_code(d.pop("code"))

        determined_by = PointCountryDeterminedBy(d.pop("determinedBy"))

        area = d.pop("area", UNSET)

        boundary_release = d.pop("boundaryRelease", UNSET)

        detail = d.pop("detail", UNSET)

        point_country = cls(
            code=code,
            determined_by=determined_by,
            area=area,
            boundary_release=boundary_release,
            detail=detail,
        )

        point_country.additional_properties = d
        return point_country

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
