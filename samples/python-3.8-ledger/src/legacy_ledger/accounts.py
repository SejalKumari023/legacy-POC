"""Transactions intentionally use an API removed in Python 3.12."""

import imp
from decimal import Decimal
from pathlib import Path


_rules = imp.load_source(
    "legacy_ledger_fee_rules", str(Path(__file__).with_name("fee_rules.py"))
)


def transact(balance, action, amount, account_type="standard"):
    """Return the new balance as a two-decimal string, or raise ValueError."""
    opening = Decimal(str(balance))
    value = Decimal(str(amount))
    if value <= 0:
        raise ValueError("amount must be positive")
    if action == "deposit":
        closing = opening + value
    elif action == "withdraw":
        fee = _rules.withdrawal_fee(account_type)
        if value + fee > opening:
            raise ValueError("insufficient funds")
        closing = opening - value - fee
    else:
        raise ValueError("unsupported transaction")
    return format(closing.quantize(Decimal("0.01")), ".2f")
