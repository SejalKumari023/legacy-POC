#!/usr/bin/env python3
"""Verify this sample across real Python 3.8 and 3.12 interpreters.

This is a case-study verifier, not a general Python migration validator.
It reads two separate checkouts and writes one JSON report to stdout.
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path


def run(executable, args, project):
    env = os.environ.copy()
    env["PYTHONPATH"] = str(project / "src")
    try:
        return subprocess.run(
            [executable] + args,
            cwd=str(project),
            env=env,
            capture_output=True,
            text=True,
            timeout=90,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        return error


def runtime(executable, project):
    result = run(
        executable,
        ["-c", "import sys; print('.'.join(map(str, sys.version_info[:3])))"],
        project,
    )
    if isinstance(result, Exception):
        return None, str(result)
    if result.returncode:
        return None, result.stderr.strip()[-1000:]
    return result.stdout.strip(), None


def inspect(project, executable, expected_version):
    version, version_error = runtime(executable, project)
    tests = run(executable, ["-m", "unittest", "discover", "-s", "tests", "-v"], project)
    behavior = run(executable, ["-m", "legacy_ledger.characterize"], project)
    tests_passed = not isinstance(tests, Exception) and tests.returncode == 0
    match = re.search(r"Ran (\d+) tests?", tests.stderr) if not isinstance(tests, Exception) else None
    observations = None
    if not isinstance(behavior, Exception) and behavior.returncode == 0:
        try:
            observations = json.loads(behavior.stdout)
            if not isinstance(observations, list) or not observations:
                observations = None
        except json.JSONDecodeError:
            pass
    errors = []
    if version_error:
        errors.append("Runtime check failed: " + version_error)
    elif not version.startswith(expected_version + "."):
        errors.append("Expected Python " + expected_version + ", found " + version)
    if not tests_passed:
        errors.append("Tests failed: " + (str(tests) if isinstance(tests, Exception) else tests.stderr.strip()[-1000:]))
    if observations is None:
        errors.append("Behavior capture failed: " + (str(behavior) if isinstance(behavior, Exception) else behavior.stderr.strip()[-1000:]))
    summary = {
        "runtime": version,
        "testsPassed": tests_passed,
        "testCount": int(match.group(1)) if match else 0,
        "behaviorCaptured": observations is not None,
        "errors": errors,
    }
    return summary, observations


def digest(observations):
    canonical = json.dumps(observations, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def declared_python(project):
    text = (project / "pyproject.toml").read_text(encoding="utf-8")
    match = re.search(r"requires-python\s*=\s*['\"]([^'\"]+)['\"]", text)
    return match.group(1) if match else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline-dir", required=True, type=Path)
    parser.add_argument("--candidate-dir", required=True, type=Path)
    parser.add_argument("--python38", required=True)
    parser.add_argument("--python312", required=True)
    args = parser.parse_args()
    baseline = args.baseline_dir.resolve()
    candidate = args.candidate_dir.resolve()
    if baseline == candidate:
        parser.error("baseline and candidate must be separate checkouts")
    for project in (baseline, candidate):
        if not (project / "pyproject.toml").is_file():
            parser.error("missing pyproject.toml in " + str(project))

    before, before_cases = inspect(baseline, args.python38, "3.8")
    after, after_cases = inspect(candidate, args.python312, "3.12")
    before["requiresPython"] = declared_python(baseline)
    after["requiresPython"] = declared_python(candidate)
    if before["requiresPython"] is None or "3.8" not in before["requiresPython"]:
        before["errors"].append("Baseline pyproject.toml does not declare Python 3.8")
    if after["requiresPython"] is None or "3.12" not in after["requiresPython"] or "3.8" in after["requiresPython"]:
        after["errors"].append("Candidate pyproject.toml does not declare Python 3.12 as its target")
    before_hash = digest(before_cases) if before_cases is not None else None
    after_hash = digest(after_cases) if after_cases is not None else None
    matched = before_cases is not None and after_cases is not None and before_cases == after_cases
    case_count = len(before_cases) if before_cases is not None else 0
    passed = (
        not before["errors"]
        and not after["errors"]
        and before["testCount"] > 0
        and after["testCount"] > 0
        and matched
        and case_count > 0
    )
    report = {
        "profile": "python-3.8-to-3.12",
        "baseline": before,
        "target": after,
        "behavior": {
            "matched": matched,
            "caseCount": case_count,
            "baselineSha256": before_hash,
            "targetSha256": after_hash,
        },
        "passed": bool(passed),
    }
    print(json.dumps(report, sort_keys=True))
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
