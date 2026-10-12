from decimal import Decimal


def withdrawal_fee(account_type):
    if account_type == "standard":
        return Decimal("1.00")
    if account_type == "premium":
        return Decimal("0.00")
    raise ValueError("unknown account type")
