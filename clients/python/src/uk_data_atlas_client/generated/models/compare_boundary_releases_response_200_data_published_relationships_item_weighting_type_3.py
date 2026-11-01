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

if TYPE_CHECKING:
    from ..models.compare_boundary_releases_response_200_data_published_relationships_item_weighting_type_3_blocks import (
        CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType3Blocks,
    )


T = TypeVar(
    "T",
    bound="CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType3",
)


@_attrs_define
class CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType3:
    """
    Attributes:
        basis (Literal['population']):
        blocks (CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType3Blocks):
        date (str):
        normalisation (Literal['per-source']):
        population (str):
        status (Literal['provided']):
    """

    basis: Literal["population"]
    blocks: CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType3Blocks
    date: str
    normalisation: Literal["per-source"]
    population: str
    status: Literal["provided"]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        basis = self.basis

        blocks = self.blocks.to_dict()

        date = self.date

        normalisation = self.normalisation

        population = self.population

        status = self.status

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
        from ..models.compare_boundary_releases_response_200_data_published_relationships_item_weighting_type_3_blocks import (
            CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType3Blocks,
        )

        d = dict(src_dict)
        basis = cast(Literal["population"], d.pop("basis"))
        if basis != "population":
            raise ValueError(f"basis must match const 'population', got '{basis}'")

        blocks = CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType3Blocks.from_dict(
            d.pop("blocks")
        )

        date = d.pop("date")

        normalisation = cast(Literal["per-source"], d.pop("normalisation"))
        if normalisation != "per-source":
            raise ValueError(
                f"normalisation must match const 'per-source', got '{normalisation}'"
            )

        population = d.pop("population")

        status = cast(Literal["provided"], d.pop("status"))
        if status != "provided":
            raise ValueError(f"status must match const 'provided', got '{status}'")

        compare_boundary_releases_response_200_data_published_relationships_item_weighting_type_3 = cls(
            basis=basis,
            blocks=blocks,
            date=date,
            normalisation=normalisation,
            population=population,
            status=status,
        )

        compare_boundary_releases_response_200_data_published_relationships_item_weighting_type_3.additional_properties = d
        return compare_boundary_releases_response_200_data_published_relationships_item_weighting_type_3

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
