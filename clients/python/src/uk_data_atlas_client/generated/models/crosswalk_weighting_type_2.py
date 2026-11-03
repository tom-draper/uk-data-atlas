from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.crosswalk_weighting_type_2_basis import CrosswalkWeightingType2Basis
from ..models.crosswalk_weighting_type_2_normalisation import (
    CrosswalkWeightingType2Normalisation,
)
from ..models.crosswalk_weighting_type_2_status import CrosswalkWeightingType2Status

if TYPE_CHECKING:
    from ..models.crosswalk_side import CrosswalkSide


T = TypeVar("T", bound="CrosswalkWeightingType2")


@_attrs_define
class CrosswalkWeightingType2:
    """Each record's target weights are shares of the source's resident population living in each published target, counted
    from fine building blocks, and sum to 1 within rounding.

        Attributes:
            basis (CrosswalkWeightingType2Basis):
            blocks (CrosswalkSide):
            date (str): The reference date of the count.
            normalisation (CrosswalkWeightingType2Normalisation):
            population (str): What was counted, such as Census 2021 usual residents.
            status (CrosswalkWeightingType2Status):
    """

    basis: CrosswalkWeightingType2Basis
    blocks: CrosswalkSide
    date: str
    normalisation: CrosswalkWeightingType2Normalisation
    population: str
    status: CrosswalkWeightingType2Status
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        basis = self.basis.value

        blocks = self.blocks.to_dict()

        date = self.date

        normalisation = self.normalisation.value

        population = self.population

        status = self.status.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "basis": basis,
                "blocks": blocks,
                "date": date,
                "normalisation": normalisation,
                "population": population,
                "status": status,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.crosswalk_side import CrosswalkSide

        d = dict(src_dict)
        basis = CrosswalkWeightingType2Basis(d.pop("basis"))

        blocks = CrosswalkSide.from_dict(d.pop("blocks"))

        date = d.pop("date")

        normalisation = CrosswalkWeightingType2Normalisation(d.pop("normalisation"))

        population = d.pop("population")

        status = CrosswalkWeightingType2Status(d.pop("status"))

        crosswalk_weighting_type_2 = cls(
            basis=basis,
            blocks=blocks,
            date=date,
            normalisation=normalisation,
            population=population,
            status=status,
        )

        crosswalk_weighting_type_2.additional_properties = d
        return crosswalk_weighting_type_2

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
