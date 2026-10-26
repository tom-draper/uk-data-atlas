from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.tile_json_envelope_data_vector_layers_item import (
        TileJsonEnvelopeDataVectorLayersItem,
    )


T = TypeVar("T", bound="TileJsonEnvelopeData")


@_attrs_define
class TileJsonEnvelopeData:
    """TileJSON 3.0, with the archive's content hash added.

    Attributes:
        bounds (list[float]):
        maxzoom (int):
        minzoom (int):
        tilejson (str):
        tiles (list[str]):
        vector_layers (list[TileJsonEnvelopeDataVectorLayersItem]):
        attribution (str | Unset):
        center (list[float] | Unset):
        description (str | Unset):
        format_ (str | Unset):
        name (str | Unset):
        scheme (str | Unset):
    """

    bounds: list[float]
    maxzoom: int
    minzoom: int
    tilejson: str
    tiles: list[str]
    vector_layers: list[TileJsonEnvelopeDataVectorLayersItem]
    attribution: str | Unset = UNSET
    center: list[float] | Unset = UNSET
    description: str | Unset = UNSET
    format_: str | Unset = UNSET
    name: str | Unset = UNSET
    scheme: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        bounds = self.bounds

        maxzoom = self.maxzoom

        minzoom = self.minzoom

        tilejson = self.tilejson

        tiles = self.tiles

        vector_layers = []
        for vector_layers_item_data in self.vector_layers:
            vector_layers_item = vector_layers_item_data.to_dict()
            vector_layers.append(vector_layers_item)

        attribution = self.attribution

        center: list[float] | Unset = UNSET
        if not isinstance(self.center, Unset):
            center = self.center

        description = self.description

        format_ = self.format_

        name = self.name

        scheme = self.scheme

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "bounds": bounds,
                "maxzoom": maxzoom,
                "minzoom": minzoom,
                "tilejson": tilejson,
                "tiles": tiles,
                "vector_layers": vector_layers,
            }
        )
        if attribution is not UNSET:
            field_dict["attribution"] = attribution
        if center is not UNSET:
            field_dict["center"] = center
        if description is not UNSET:
            field_dict["description"] = description
        if format_ is not UNSET:
            field_dict["format"] = format_
        if name is not UNSET:
            field_dict["name"] = name
        if scheme is not UNSET:
            field_dict["scheme"] = scheme

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.tile_json_envelope_data_vector_layers_item import (
            TileJsonEnvelopeDataVectorLayersItem,
        )

        d = dict(src_dict)
        bounds = cast(list[float], d.pop("bounds"))

        maxzoom = d.pop("maxzoom")

        minzoom = d.pop("minzoom")

        tilejson = d.pop("tilejson")

        tiles = cast(list[str], d.pop("tiles"))

        vector_layers = []
        _vector_layers = d.pop("vector_layers")
        for vector_layers_item_data in _vector_layers:
            vector_layers_item = TileJsonEnvelopeDataVectorLayersItem.from_dict(
                vector_layers_item_data
            )

            vector_layers.append(vector_layers_item)

        attribution = d.pop("attribution", UNSET)

        center = cast(list[float], d.pop("center", UNSET))

        description = d.pop("description", UNSET)

        format_ = d.pop("format", UNSET)

        name = d.pop("name", UNSET)

        scheme = d.pop("scheme", UNSET)

        tile_json_envelope_data = cls(
            bounds=bounds,
            maxzoom=maxzoom,
            minzoom=minzoom,
            tilejson=tilejson,
            tiles=tiles,
            vector_layers=vector_layers,
            attribution=attribution,
            center=center,
            description=description,
            format_=format_,
            name=name,
            scheme=scheme,
        )

        tile_json_envelope_data.additional_properties = d
        return tile_json_envelope_data

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
