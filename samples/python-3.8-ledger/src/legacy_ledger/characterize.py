"""Emit deterministic observable outcomes for before/after comparison."""

import json

from .accounts import transact


CASES = [
    ("deposit", ("100.00", "deposit", "25.50"), {}),
    ("standard withdrawal", ("100.00", "withdraw", "20.00"), {}),
    ("premium withdrawal", ("100.00", "withdraw", "20.00"), {"account_type": "premium"}),
    ("overdraft", ("20.00", "withdraw", "20.00"), {}),
    ("invalid amount", ("100.00", "deposit", "0"), {}),
    ("unsupported action", ("100.00", "transfer", "10.00"), {}),
]


def snapshot():
    outcomes = []
    for name, args, kwargs in CASES:
        try:
            outcomes.append({"case": name, "result": transact(*args, **kwargs)})
        except Exception as error:
            outcomes.append({"case": name, "exception": type(error).__name__, "message": str(error)})
    return outcomes


if __name__ == "__main__":
    print(json.dumps(snapshot(), sort_keys=True, separators=(",", ":")))
