"""Independent interval arithmetic checks; these tests do not use the database."""

from datetime import datetime, timedelta, timezone

import pytest

from app.services.recorded_time import (
    MAX_INTERVALS,
    daily_recording_totals,
    merge_recordings,
    normalize_recording,
    recording_seconds,
)

START = datetime(2026, 11, 13, 8)
END = START + timedelta(hours=2)


def interval(start, end):
    return {"start_at": start.isoformat() + "Z", "end_at": end.isoformat() + "Z"}


def recording(*pairs, truncated=False):
    return {"version": 1, "intervals": [interval(*pair) for pair in pairs], "truncated": truncated}


def normalize(value, *, started_at=START, expires_at=END, now=END):
    return normalize_recording(value, started_at=started_at, expires_at=expires_at, now=now)


def test_clip_to_actual_lifetime_and_never_credit_hidden_gaps():
    raw = recording(
        (START - timedelta(minutes=10), START + timedelta(minutes=3)),
        (START + timedelta(minutes=10), START + timedelta(minutes=30)),
        (END + timedelta(days=1), END + timedelta(days=2)),
    )
    result = normalize(raw, now=START + timedelta(minutes=15))
    assert result == recording(
        (START, START + timedelta(minutes=3)),
        (START + timedelta(minutes=10), START + timedelta(minutes=15)),
    )
    assert recording_seconds(result) == 8 * 60
    assert raw["intervals"][0]["start_at"] == "2026-11-13T07:50:00Z"


def test_overlapping_and_adjacent_intervals_are_unioned_before_rounding():
    result = normalize(
        recording(
            (START + timedelta(seconds=8), START + timedelta(seconds=10)),
            (START, START + timedelta(seconds=5)),
            (START + timedelta(seconds=3), START + timedelta(seconds=8)),
        )
    )
    assert result == recording((START, START + timedelta(seconds=10)))
    assert recording_seconds(result) == 10


def test_server_cap_expiry_and_future_start_cannot_create_extra_credit():
    raw = recording((START - timedelta(days=1), START + timedelta(days=1)))
    assert (
        recording_seconds(
            normalize(raw, expires_at=START + timedelta(days=1), now=START + timedelta(days=1))
        )
        == 7200
    )
    assert recording_seconds(normalize(raw, expires_at=START + timedelta(seconds=13))) == 13
    assert normalize(raw, now=START - timedelta(seconds=1)) == recording()


def test_aware_bounds_are_normalized_to_utc_without_using_local_timezone():
    local_start = START.replace(hour=3, tzinfo=timezone(timedelta(hours=-5)))
    result = normalize(recording((START, START + timedelta(minutes=2))), started_at=local_start)
    assert recording_seconds(result) == 120


@pytest.mark.parametrize(
    "value",
    [
        {},
        False,
        [],
        {"version": True, "intervals": []},
        {"version": 2, "intervals": []},
        {"version": 1, "intervals": None},
        {"version": 1, "intervals": [], "extra": 1},
        {"version": 1, "intervals": [], "truncated": 1},
        {"version": 1, "intervals": [None]},
        {"version": 1, "intervals": [{"start_at": "2026-11-13T08:00:00Z"}]},
        {
            "version": 1,
            "intervals": [{"start_at": "2026-11-13T08:00:00", "end_at": "2026-11-13T08:01:00Z"}],
        },
        {
            "version": 1,
            "intervals": [
                {"start_at": "2026-11-13T08:00:00+00:00", "end_at": "2026-11-13T08:01:00Z"}
            ],
        },
        {
            "version": 1,
            "intervals": [{"start_at": "2026-02-30T08:00:00Z", "end_at": "2026-11-13T08:01:00Z"}],
        },
        {
            "version": 1,
            "intervals": [{"start_at": "2026-11-13T08:00:00Z", "end_at": "2026-11-13T07:59:59Z"}],
        },
        {
            "version": 1,
            "intervals": [
                {
                    "start_at": "2026-11-13T08:00:00Z",
                    "end_at": "2026-11-13T08:01:00Z",
                    "id": "other",
                }
            ],
        },
        {"version": 1, "intervals": [interval(START, START)] * (MAX_INTERVALS + 1)},
    ],
)
def test_malformed_protocol_is_bounded_and_rejected(value):
    with pytest.raises(ValueError):
        normalize(value)


def test_unknown_zero_and_omitted_updates_remain_distinct_and_idempotent():
    assert normalize(None) is None
    assert recording_seconds(None) is None
    assert recording_seconds(normalize(recording())) == 0
    saved = recording((START, START + timedelta(seconds=25)))
    options = {"started_at": START, "expires_at": END, "now": END}
    assert merge_recordings(saved, saved, **options) == saved
    assert merge_recordings(saved, None, **options) == saved
    assert merge_recordings(None, None, **options) is None
    assert merge_recordings(None, recording(), **options) == recording()


def test_overflow_retains_only_real_longest_intervals_and_marks_partial_evidence():
    first = recording(
        *[
            (START + timedelta(seconds=2 * i), START + timedelta(seconds=2 * i + 1))
            for i in range(256)
        ]
    )
    second = recording(
        *[
            (START + timedelta(seconds=2 * i), START + timedelta(seconds=2 * i + 1))
            for i in range(256, 512)
        ]
    )
    result = merge_recordings(first, second, started_at=START, expires_at=END, now=END)
    assert len(result["intervals"]) == 256
    assert result["truncated"] is True
    assert recording_seconds(result) == 256
    assert all(item["start_at"] != item["end_at"] for item in result["intervals"])


def test_daily_union_across_sessions_counts_overlap_once_and_keeps_unknown_separate():
    first = recording((START, START + timedelta(minutes=10)))
    second = recording(
        (START + timedelta(minutes=5), START + timedelta(minutes=15)), truncated=True
    )
    result = daily_recording_totals(
        [first, second, None, {"bad": "record"}, recording()], day=START.date(), now=END
    )
    assert result == {
        "recorded_seconds": 900,
        "recorded_sessions": 2,
        "unknown_duration_sessions": 2,
        "partial_duration_sessions": 1,
    }


def test_utc_midnight_splits_real_segments_instead_of_moving_them_to_completion_day():
    before = datetime(2026, 11, 12, 23, 59, 30)
    after = before + timedelta(minutes=1)
    value = recording((before, after))
    now = after + timedelta(minutes=10)
    assert daily_recording_totals([value], day=before.date(), now=now)["recorded_seconds"] == 30
    assert daily_recording_totals([value], day=after.date(), now=now)["recorded_seconds"] == 30


def test_daily_rounding_occurs_after_union_and_future_time_is_not_counted():
    first = recording((START, START + timedelta(milliseconds=600)))
    second = recording((START + timedelta(milliseconds=700), START + timedelta(milliseconds=1300)))
    assert recording_seconds(first) == recording_seconds(second) == 0
    totals = daily_recording_totals([first, second], day=START.date(), now=END)
    assert totals["recorded_seconds"] == 1
    future = recording((END, END + timedelta(hours=1)))
    assert daily_recording_totals([future], day=START.date(), now=START)["recorded_seconds"] == 0
