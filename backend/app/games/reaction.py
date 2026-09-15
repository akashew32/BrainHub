import math
import statistics


def reaction_stats(
    times: list[float], false_starts: int = 0, correct: int | None = None
) -> dict[str, float | int]:
    if not times:
        return {
            "average_ms": 0,
            "median_ms": 0,
            "best_ms": 0,
            "stddev_ms": 0,
            "false_starts": false_starts,
            "accuracy": 0,
        }
    correct = len(times) if correct is None else correct
    total = correct + false_starts
    return {
        "average_ms": round(statistics.fmean(times), 1),
        "median_ms": round(statistics.median(times), 1),
        "best_ms": round(min(times), 1),
        "stddev_ms": round(statistics.pstdev(times), 1) if len(times) > 1 else 0,
        "false_starts": false_starts,
        "accuracy": round(100 * correct / total, 1) if total else 0,
        "consistency": max(0, round(100 - math.sqrt(statistics.pvariance(times)) / 2, 1))
        if len(times) > 1
        else 100,
    }
