from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Optional as _Optional

DESCRIPTOR: _descriptor.FileDescriptor

class TradingSignal(_message.Message):
    __slots__ = ("symbol", "quantity", "price")
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    QUANTITY_FIELD_NUMBER: _ClassVar[int]
    PRICE_FIELD_NUMBER: _ClassVar[int]
    symbol: str
    quantity: float
    price: float
    def __init__(self, symbol: _Optional[str] = ..., quantity: _Optional[float] = ..., price: _Optional[float] = ...) -> None: ...

class OrderRequest(_message.Message):
    __slots__ = ("symbol", "quantity", "price")
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    QUANTITY_FIELD_NUMBER: _ClassVar[int]
    PRICE_FIELD_NUMBER: _ClassVar[int]
    symbol: str
    quantity: float
    price: float
    def __init__(self, symbol: _Optional[str] = ..., quantity: _Optional[float] = ..., price: _Optional[float] = ...) -> None: ...

class OrderResponse(_message.Message):
    __slots__ = ("order_id", "status")
    ORDER_ID_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    order_id: str
    status: str
    def __init__(self, order_id: _Optional[str] = ..., status: _Optional[str] = ...) -> None: ...
