from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """API models use camelCase on the wire to match the Angular client."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class Envelope[T](CamelModel):
    """Standard response envelope (spec §72)."""

    success: bool = True
    data: T
    message: str | None = None
