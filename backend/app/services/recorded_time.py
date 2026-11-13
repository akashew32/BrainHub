"""Bounded visible-time intervals, not claims about attention or actual study.

Only finalized, owned assessments belong in daily totals. Callers select the
relevant completion window before passing records here; old NULL records remain
unknown. Intervals use explicit UTC, and no time is inferred between segments.
"""

from __future__ import annotations

import math
import re
from collections.abc import Iterable
from datetime import UTC, date, datetime, time, timedelta
from typing import Any

MAX_INTERVALS = 256
MAX_SESSION_SECONDS = 7200
_UTC_ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$")
_Interval = tuple[datetime, datetime]


def _naive_utc(value: datetime) -> datetime:
    return value.astimezone(UTC).replace(tzinfo=None) if value.tzinfo else value


def _parse_time(value: Any) -> datetime:
    if not isinstance(value, str) or len(value) > 40 or not _UTC_ISO.fullmatch(value):
        raise ValueError("Recorded time requires explicit UTC timestamps ending in Z.")
    try:
        return datetime.fromisoformat(value[:-1])
    except ValueError as error:
        raise ValueError("Recorded time contains an invalid UTC timestamp.") from error


def _read(recording: Any) -> tuple[list[_Interval], bool]:
    if (
        not isinstance(recording, dict)
        or set(recording) - {"version", "intervals", "truncated"}
        or type(recording.get("version")) is not int
        or recording["version"] != 1
        or not isinstance(recording.get("intervals"), list)
        or len(recording["intervals"]) > MAX_INTERVALS
        or type(recording.get("truncated", False)) is not bool
    ):
        raise ValueError("Use version 1 recorded time with at most 256 intervals.")
    intervals = []
    for item in recording["intervals"]:
        if not isinstance(item, dict) or set(item) != {"start_at", "end_at"}:
            raise ValueError("Each recorded interval needs only start_at and end_at.")
        start, end = _parse_time(item["start_at"]), _parse_time(item["end_at"])
        if end < start:
            raise ValueError("A recorded interval cannot end before it starts.")
        if end > start:
            intervals.append((start, end))
    return intervals, recording.get("truncated", False)


def _union(intervals: Iterable[_Interval]) -> list[_Interval]:
    merged: list[_Interval] = []
    for start, end in sorted(intervals):
        if not merged or start > merged[-1][1]:
            merged.append((start, end))
        elif end > merged[-1][1]:
            merged[-1] = (merged[-1][0], end)
    return merged


def _clip(intervals: Iterable[_Interval], lower: datetime, upper: datetime) -> list[_Interval]:
    if upper <= lower:
        return []
    return [
        (max(start, lower), min(end, upper))
        for start, end in intervals
        if min(end, upper) > max(start, lower)
    ]


def _pack(intervals: Iterable[_Interval], *, truncated: bool) -> dict[str, Any]:
    merged = _union(intervals)
    if len(merged) > MAX_INTERVALS:
        # Keeping real intervals undercounts excess activity instead of turning
        # hidden gaps into time. The flag preserves that limitation for the UI.
        merged = sorted(
            sorted(merged, key=lambda item: (-(item[1] - item[0]).total_seconds(), item))[
                :MAX_INTERVALS
            ]
        )
        truncated = True
    return {
        "version": 1,
        "intervals": [
            {"start_at": start.isoformat() + "Z", "end_at": end.isoformat() + "Z"}
            for start, end in merged
        ],
        "truncated": truncated,
    }


def normalize_recording(
    recording: Any,
    *,
    started_at: datetime,
    expires_at: datetime,
    now: datetime,
) -> dict[str, Any] | None:
    """Validate and clip supplied activity to the real assessment lifetime."""
    if recording is None:
        return None
    intervals, truncated = _read(recording)
    lower = _naive_utc(started_at)
    try:
        cap = lower + timedelta(seconds=MAX_SESSION_SECONDS)
    except OverflowError:
        cap = datetime.max
    upper = min(_naive_utc(expires_at), _naive_utc(now), cap)
    return _pack(_clip(intervals, lower, upper), truncated=truncated)


def merge_recordings(
    previous: Any,
    candidate: Any,
    *,
    started_at: datetime,
    expires_at: datetime,
    now: datetime,
) -> dict[str, Any] | None:
    """Append time evidence; an omitted field cannot erase earlier intervals."""
    intervals: list[_Interval] = []
    known = False
    truncated = False
    for recording in (previous, candidate):
        normalized = normalize_recording(
            recording, started_at=started_at, expires_at=expires_at, now=now
        )
        if normalized is not None:
            known = True
            values, limited = _read(normalized)
            intervals.extend(values)
            truncated |= limited
    return _pack(intervals, truncated=truncated) if known else None


def recording_seconds(recording: Any) -> int | None:
    if recording is None:
        return None
    intervals, _ = _read(recording)
    seconds = sum((end - start).total_seconds() for start, end in _union(intervals))
    return min(MAX_SESSION_SECONDS, math.floor(seconds))


def daily_recording_totals(
    recordings: Iterable[Any], *, day: date, now: datetime
) -> dict[str, int]:
    """Union actual UTC intervals across sessions; round only the final union."""
    lower = datetime.combine(day, time.min)
    upper = min(lower + timedelta(days=1), _naive_utc(now))
    intervals: list[_Interval] = []
    known = unknown = partial = 0
    for recording in recordings:
        if recording is None:
            unknown += 1
            continue
        try:
            values, truncated = _read(recording)
        except (ValueError, TypeError):
            unknown += 1
            continue
        clipped = _clip(values, lower, upper)
        if clipped:
            known += 1
            intervals.extend(clipped)
        partial += int(truncated)
    return {
        "recorded_seconds": math.floor(
            sum((end - start).total_seconds() for start, end in _union(intervals))
        ),
        "recorded_sessions": known,
        "unknown_duration_sessions": unknown,
        "partial_duration_sessions": partial,
    }
