from __future__ import annotations

import json
from typing import Any, Literal
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

Language = Literal["python", "java", "cpp"]
JUDGE0_URL = "https://ce.judge0.com/submissions/?base64_encoded=false&wait=true"
LANGUAGE_IDS: dict[Language, int] = {"python": 100, "java": 91, "cpp": 105}
MARKER = "__BRAINHUB_CASE__"


def _clean_marker_text(value: Any) -> str:
    return str(value).replace("\t", " ").replace("\r", " ").replace("\n", " ")


def _java_literal(value: Any, kind: str) -> str:
    if kind in {"int", "long"}:
        return f"{value}{'L' if kind == 'long' else ''}"
    if kind == "boolean":
        return str(value).lower()
    if kind == "String":
        return json.dumps(value)
    if kind == "int[]":
        return "new int[]{" + ",".join(str(item) for item in value) + "}"
    if kind == "String[]":
        return "new String[]{" + ",".join(json.dumps(item) for item in value) + "}"
    if kind == "int[][]":
        rows = ["{" + ",".join(str(item) for item in row) + "}" for row in value]
        return "new int[][]{" + ",".join(rows) + "}"
    raise ValueError(f"Unsupported Java value type: {kind}")


def _cpp_literal(value: Any, kind: str) -> str:
    if kind in {"int", "long"}:
        return f"{value}{'LL' if kind == 'long' else ''}"
    if kind == "boolean":
        return str(value).lower()
    if kind == "String":
        return json.dumps(value)
    if kind == "int[]":
        return "vector<int>{" + ",".join(str(item) for item in value) + "}"
    if kind == "String[]":
        return "vector<string>{" + ",".join(json.dumps(item) for item in value) + "}"
    if kind == "int[][]":
        rows = ["{" + ",".join(str(item) for item in row) + "}" for row in value]
        return "vector<vector<int>>{" + ",".join(rows) + "}"
    raise ValueError(f"Unsupported C++ value type: {kind}")


def _python_harness(source: str, challenge: dict[str, Any], cases: list[dict[str, Any]]) -> str:
    method = challenge["signature"]["method"]
    payload = json.dumps(cases, separators=(",", ":"))
    return f"""{source}

import json as _brainhub_json
import sys as _brainhub_sys

_brainhub_cases = _brainhub_json.loads({json.dumps(payload)})
_brainhub_solution = Solution()

def _brainhub_clean(value):
    return str(value).replace("\\t", " ").replace("\\r", " ").replace("\\n", " ")

for _brainhub_index, _brainhub_case in enumerate(_brainhub_cases):
    try:
        _brainhub_actual = _brainhub_solution.{method}(*_brainhub_case["args"])
        _brainhub_expected = _brainhub_case["expected"]
        _brainhub_passed = _brainhub_actual == _brainhub_expected
        print(
            "{MARKER}\\t{{}}\\t{{}}\\t{{}}\\t{{}}".format(
                _brainhub_index,
                1 if _brainhub_passed else 0,
                _brainhub_clean(_brainhub_expected),
                _brainhub_clean(_brainhub_actual),
            ),
            file=_brainhub_sys.stderr,
        )
    except Exception as _brainhub_error:
        print(
            "{MARKER}\\t{{}}\\t0\\t{{}}\\terror: {{}}".format(
                _brainhub_index,
                _brainhub_clean(_brainhub_case["expected"]),
                _brainhub_clean(_brainhub_error),
            ),
            file=_brainhub_sys.stderr,
        )
"""


def _java_harness(source: str, challenge: dict[str, Any], cases: list[dict[str, Any]]) -> str:
    signature = challenge["signature"]
    params = signature["params"]
    calls: list[str] = []
    for index, case in enumerate(cases):
        arguments = ", ".join(
            _java_literal(value, param["type"])
            for value, param in zip(case["args"], params, strict=True)
        )
        expected = _java_literal(case["expected"], signature["returnType"])
        calls.append(
            f"""
        try {{
            var actual = solution.{signature["method"]}({arguments});
            var expected = {expected};
            boolean passed = Objects.deepEquals(actual, expected);
            System.err.println(MARKER + "\\t{index}\\t" + (passed ? "1" : "0") + "\\t" + clean(render(expected)) + "\\t" + clean(render(actual)));
        }} catch (Throwable error) {{
            System.err.println(MARKER + "\\t{index}\\t0\\t" + clean(render({expected})) + "\\terror: " + clean(error.toString()));
        }}
"""
        )
    return f"""import java.util.*;
{source}

class Main {{
    static final String MARKER = "{MARKER}";

    static String clean(String value) {{
        return value.replace('\\t', ' ').replace('\\r', ' ').replace('\\n', ' ');
    }}

    static String render(Object value) {{
        if (value == null) return "null";
        if (value instanceof int[] array) return Arrays.toString(array);
        if (value instanceof long[] array) return Arrays.toString(array);
        if (value instanceof Object[] array) return Arrays.deepToString(array);
        return String.valueOf(value);
    }}

    public static void main(String[] args) {{
        Solution solution = new Solution();
        {"".join(calls)}
    }}
}}
"""


def _cpp_harness(source: str, challenge: dict[str, Any], cases: list[dict[str, Any]]) -> str:
    signature = challenge["signature"]
    params = signature["params"]
    calls: list[str] = []
    for index, case in enumerate(cases):
        arguments = ", ".join(
            _cpp_literal(value, param["type"])
            for value, param in zip(case["args"], params, strict=True)
        )
        expected = _cpp_literal(case["expected"], signature["returnType"])
        calls.append(
            f"""
    try {{
        auto actual = solution.{signature["method"]}({arguments});
        auto expected = {expected};
        bool passed = actual == expected;
        cerr << MARKER << "\\t{index}\\t" << (passed ? "1" : "0") << "\\t" << clean(render(expected)) << "\\t" << clean(render(actual)) << "\\n";
    }} catch (const exception& error) {{
        cerr << MARKER << "\\t{index}\\t0\\t" << clean(render({expected})) << "\\terror: " << clean(error.what()) << "\\n";
    }}
"""
        )
    return f"""#include <bits/stdc++.h>
using namespace std;

{source}

const string MARKER = "{MARKER}";

string clean(string value) {{
    for (char& character : value) if (character == '\\t' || character == '\\r' || character == '\\n') character = ' ';
    return value;
}}

string render(const string& value) {{ return value; }}
string render(bool value) {{ return value ? "true" : "false"; }}
template <class T> string render(const T& value);
template <class T> string render(const vector<T>& values) {{
    string result = "[";
    for (size_t index = 0; index < values.size(); ++index) {{
        if (index) result += ", ";
        result += render(values[index]);
    }}
    return result + "]";
}}
template <class T> string render(const T& value) {{
    ostringstream stream;
    stream << value;
    return stream.str();
}}

int main() {{
    Solution solution;
    {"".join(calls)}
    return 0;
}}
"""


def build_harness(
    source: str,
    language: Language,
    challenge: dict[str, Any],
    cases: list[dict[str, Any]],
) -> str:
    if language == "python":
        return _python_harness(source, challenge, cases)
    if language == "java":
        return _java_harness(source, challenge, cases)
    return _cpp_harness(source, challenge, cases)


def execute_remote(source: str, language: Language) -> dict[str, Any]:
    payload = json.dumps(
        {
            "source_code": source,
            "language_id": LANGUAGE_IDS[language],
            "cpu_time_limit": 5,
            "wall_time_limit": 10,
            "memory_limit": 256_000,
        }
    ).encode()
    request = Request(
        JUDGE0_URL,
        data=payload,
        method="POST",
        headers={"Content-Type": "application/json", "User-Agent": "BrainHub/1.0"},
    )
    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError) as exc:
        raise RuntimeError("The code sandbox is temporarily unavailable") from exc


def _parse_markers(stderr: str | None) -> tuple[list[dict[str, Any]], str]:
    results: list[dict[str, Any]] = []
    remaining: list[str] = []
    for line in (stderr or "").splitlines():
        if not line.startswith(f"{MARKER}\t"):
            remaining.append(line)
            continue
        parts = line.split("\t", 4)
        if len(parts) != 5:
            remaining.append(line)
            continue
        results.append(
            {
                "index": int(parts[1]),
                "passed": parts[2] == "1",
                "expected": _clean_marker_text(parts[3]),
                "actual": _clean_marker_text(parts[4]),
            }
        )
    return results, "\n".join(remaining)


def run_challenge(
    challenge: dict[str, Any], language: Language, source: str, mode: Literal["run", "submit"]
) -> dict[str, Any]:
    case_limit = 3 if mode == "run" else 20
    cases = challenge["cases"][:case_limit]
    harness = build_harness(source, language, challenge, cases)
    execution = execute_remote(harness, language)
    case_results, user_stderr = _parse_markers(execution.get("stderr"))
    terminal_parts = [execution.get("stdout") or "", user_stderr]
    if execution.get("compile_output"):
        terminal_parts.append(execution["compile_output"])
    if execution.get("message"):
        terminal_parts.append(execution["message"])
    terminal = "\n".join(part.strip("\n") for part in terminal_parts if part).strip()
    passed = sum(1 for result in case_results if result["passed"])
    status = execution.get("status") or {"id": 0, "description": "Unknown"}
    return {
        "status": status,
        "terminal": terminal,
        "results": case_results,
        "passed": passed,
        "total": len(cases),
        "complete": status.get("id") == 3 and passed == len(cases),
        "time": execution.get("time"),
        "memory": execution.get("memory"),
        "provider": "Judge0 CE",
    }
