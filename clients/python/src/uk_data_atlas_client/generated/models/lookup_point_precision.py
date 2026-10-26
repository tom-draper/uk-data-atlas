from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.lookup_point_precision_basis import LookupPointPrecisionBasis

if TYPE_CHECKING:
    from ..models.lookup_point_precision_decimal_places_type_0 import (
        LookupPointPrecisionDecimalPlacesType0,
    )
    from ..models.lookup_point_precision_decimal_places_type_1 import (
        LookupPointPrecisionDecimalPlacesType1,
    )
    from ..models.lookup_point_precision_decimal_places_type_2 import (
        LookupPointPrecisionDecimalPlacesType2,
    )


T = TypeVar("T", bound="LookupPointPrecision")


@_attrs_define
class LookupPointPrecision:
    """
    Attributes:
        basis (LookupPointPrecisionBasis):
        decimal_places (LookupPointPrecisionDecimalPlacesType0 | LookupPointPrecisionDecimalPlacesType1 |
            LookupPointPrecisionDecimalPlacesType2):
        uncertainty_m (float): How far the true position may lie from the coordinate, in metres.
    """

    basis: LookupPointPrecisionBasis
    decimal_places: (
        LookupPointPrecisionDecimalPlacesType0
        | LookupPointPrecisionDecimalPlacesType1
        | LookupPointPrecisionDecimalPlacesType2
    )
    uncertainty_m: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.lookup_point_precision_decimal_places_type_0 import (
            LookupPointPrecisionDecimalPlacesType0,
        )
        from ..models.lookup_point_precision_decimal_places_type_1 import (
            LookupPointPrecisionDecimalPlacesType1,
        )

        basis = self.basis.value

        decimal_places: dict[str, Any]
        if isinstance(
            self.decimal_places, LookupPointPrecisionDecimalPlacesType0
        ) or isinstance(self.decimal_places, LookupPointPrecisionDecimalPlacesType1):
            decimal_places = self.decimal_places.to_dict()
        else:
            decimal_places = self.decimal_places.to_dict()

        uncertainty_m = self.uncertainty_m

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "basis": basis,
                "decimalPlaces": decimal_places,
                "uncertaintyM": uncertainty_m,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.lookup_point_precision_decimal_places_type_0 import (
            LookupPointPrecisionDecimalPlacesType0,
        )
        from ..models.lookup_point_precision_decimal_places_type_1 import (
            LookupPointPrecisionDecimalPlacesType1,
        )
        from ..models.lookup_point_precision_decimal_places_type_2 import (
            LookupPointPrecisionDecimalPlacesType2,
        )

        d = dict(src_dict)
        basis = LookupPointPrecisionBasis(d.pop("basis"))

        def _parse_decimal_places(
            data: object,
        ) -> (
            LookupPointPrecisionDecimalPlacesType0
            | LookupPointPrecisionDecimalPlacesType1
            | LookupPointPrecisionDecimalPlacesType2
        ):
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                decimal_places_type_0 = (
                    LookupPointPrecisionDecimalPlacesType0.from_dict(data)
                )

                return decimal_places_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                decimal_places_type_1 = (
                    LookupPointPrecisionDecimalPlacesType1.from_dict(data)
                )

                return decimal_places_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            decimal_places_type_2 = LookupPointPrecisionDecimalPlacesType2.from_dict(
                data
            )

            return decimal_places_type_2

        decimal_places = _parse_decimal_places(d.pop("decimalPlaces"))

        uncertainty_m = d.pop("uncertaintyM")

        lookup_point_precision = cls(
            basis=basis,
            decimal_places=decimal_places,
            uncertainty_m=uncertainty_m,
        )

        lookup_point_precision.additional_properties = d
        return lookup_point_precision

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
