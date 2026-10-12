# Python 3.8 → 3.12 case study

This intentionally legacy sample is the baseline, not a pre-modernized answer. It uses `imp.load_source`, which works on Python 3.8 but was removed in Python 3.12. The goal is to replace that loader without changing transaction results or exceptions.

From this directory on an actual Python 3.8 runtime:

```sh
PYTHONPATH=src python3.8 -m unittest discover -s tests -v
PYTHONPATH=src python3.8 -m legacy_ledger.characterize
```

After an agent migrates a separate checkout to Python 3.12, run the same tests and snapshot with Python 3.12. Use `verify_migration.py` to compare both checkouts and emit a machine-readable result. Do not describe a test under another Python version as proof of a 3.8 or 3.12 runtime.
