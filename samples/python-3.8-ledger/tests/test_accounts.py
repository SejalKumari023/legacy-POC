import unittest

from legacy_ledger import transact
from legacy_ledger.characterize import snapshot


class AccountTests(unittest.TestCase):
    def test_deposit(self):
        self.assertEqual(transact("100.00", "deposit", "25.50"), "125.50")

    def test_standard_withdrawal_includes_fee(self):
        self.assertEqual(transact("100.00", "withdraw", "20.00"), "79.00")

    def test_premium_withdrawal_has_no_fee(self):
        self.assertEqual(transact("100.00", "withdraw", "20.00", "premium"), "80.00")

    def test_insufficient_funds(self):
        with self.assertRaisesRegex(ValueError, "insufficient funds"):
            transact("20.00", "withdraw", "20.00")

    def test_invalid_amount(self):
        with self.assertRaisesRegex(ValueError, "amount must be positive"):
            transact("100.00", "deposit", "0")

    def test_characterization_cases(self):
        self.assertEqual(len(snapshot()), 6)


if __name__ == "__main__":
    unittest.main()
