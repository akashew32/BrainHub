from __future__ import annotations

import json
import math
from bisect import bisect_left
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from functools import lru_cache
from heapq import heappop, heappush
from itertools import pairwise
from pathlib import Path
from typing import Any

from challenge_expansion import build_expansion

ROOT = Path(__file__).resolve().parents[1]
FRONTEND_CATALOG = ROOT / "frontend" / "lib" / "challenge-catalog.json"
BACKEND_CATALOG = ROOT / "backend" / "app" / "challenges" / "catalog.json"
MOD = 1_000_000_007


Json = int | bool | str | list["Json"]
Reference = Callable[..., Json]


@dataclass(frozen=True)
class Problem:
    number: int
    slug: str
    title: str
    difficulty: str
    topics: tuple[str, ...]
    summary: str
    constraints: tuple[str, ...]
    params: tuple[tuple[str, str], ...]
    return_type: str
    reference: Reference
    cases: tuple[tuple[Json, ...], ...]
    category: str = "Algorithm"


def unique_twenty(
    seed_cases: list[tuple[Json, ...]], factory: Callable[[int], tuple[Json, ...]]
):
    result: list[tuple[Json, ...]] = []
    seen: set[str] = set()
    index = 0
    while len(result) < 20:
        case = seed_cases[index] if index < len(seed_cases) else factory(index)
        key = json.dumps(case, sort_keys=True, separators=(",", ":"))
        if key not in seen:
            seen.add(key)
            result.append(case)
        index += 1
        if index > 10_000:
            raise RuntimeError("Case factory failed to produce 20 unique cases")
    return tuple(result)


ARRAYS = [
    [],
    [0],
    [1],
    [-1],
    [1, 2],
    [2, 1],
    [1, 1],
    [0, 0, 1],
    [1, -1, 1],
    [3, 1, 4, 1, 5],
    [-3, -1, -2],
    [5, 4, 3, 2, 1],
    [1, 2, 3, 4, 5],
    [2, 0, 2, 1, 1, 0],
    [7, 2, 5, 10, 8],
    [1, 3, -2, 4, -1, 2],
    [8, 8, 8, 8],
    [10, -10, 10, -10, 10],
    [4, 2, 7, 2, 4, 9, 2],
    [6, 1, 9, 2, 8, 3, 7, 4, 5],
]

WORDS = [
    "",
    "a",
    "aa",
    "ab",
    "abc",
    "abba",
    "racecar",
    "algorithm",
    "mississippi",
    "brainhub",
    "abababab",
    "xyzzyx",
    "leetcode",
    "aaaaab",
    "cabacaba",
    "thequickbrownfox",
    "010101",
    "()(()",
    ")()())",
    "(()())()",
]


def ref_merge_strings(a: str, b: str) -> str:
    pieces: list[str] = []
    for index in range(max(len(a), len(b))):
        if index < len(a):
            pieces.append(a[index])
        if index < len(b):
            pieces.append(b[index])
    return "".join(pieces)


def ref_pivot(nums: list[int]) -> int:
    total = sum(nums)
    left = 0
    for index, value in enumerate(nums):
        if left == total - left - value:
            return index
        left += value
    return -1


def ref_subsequence(s: str, t: str) -> bool:
    iterator = iter(t)
    return all(char in iterator for char in s)


def ref_perfect_square(value: int) -> bool:
    if value < 0:
        return False
    root = math.isqrt(value)
    return root * root == value


def ref_max_words(sentences: list[str]) -> int:
    return max((len(sentence.split()) for sentence in sentences), default=0)


def ref_double_exists(nums: list[int]) -> bool:
    seen: set[int] = set()
    for value in nums:
        if value * 2 in seen or (value % 2 == 0 and value // 2 in seen):
            return True
        seen.add(value)
    return False


def ref_find_difference(s: str, t: str) -> str:
    value = 0
    for char in s + t:
        value ^= ord(char)
    return chr(value)


def ref_move_zeroes(nums: list[int]) -> list[int]:
    values = [value for value in nums if value != 0]
    return values + [0] * (len(nums) - len(values))


def ref_monotonic(nums: list[int]) -> bool:
    return all(a <= b for a, b in pairwise(nums)) or all(
        a >= b for a, b in pairwise(nums)
    )


def ref_degree(nums: list[int]) -> int:
    if not nums:
        return 0
    first: dict[int, int] = {}
    last: dict[int, int] = {}
    counts: Counter[int] = Counter()
    for index, value in enumerate(nums):
        first.setdefault(value, index)
        last[value] = index
        counts[value] += 1
    degree = max(counts.values())
    return min(
        last[value] - first[value] + 1
        for value, count in counts.items()
        if count == degree
    )


def ref_sort_colors(nums: list[int]) -> list[int]:
    return sorted(nums)


def ref_longest_mountain(nums: list[int]) -> int:
    best = 0
    index = 1
    while index + 1 < len(nums):
        if nums[index - 1] < nums[index] > nums[index + 1]:
            left = index - 1
            right = index + 1
            while left > 0 and nums[left - 1] < nums[left]:
                left -= 1
            while right + 1 < len(nums) and nums[right] > nums[right + 1]:
                right += 1
            best = max(best, right - left + 1)
            index = right
        index += 1
    return best


def ref_find_anagrams(text: str, pattern: str) -> list[int]:
    if not pattern or len(pattern) > len(text):
        return []
    target = Counter(pattern)
    window = Counter(text[: len(pattern)])
    result = [0] if window == target else []
    for index in range(len(pattern), len(text)):
        outgoing = text[index - len(pattern)]
        window[outgoing] -= 1
        if window[outgoing] == 0:
            del window[outgoing]
        window[text[index]] += 1
        if window == target:
            result.append(index - len(pattern) + 1)
    return result


def ref_subarray_sum(nums: list[int], target: int) -> int:
    counts = {0: 1}
    prefix = 0
    result = 0
    for value in nums:
        prefix += value
        result += counts.get(prefix - target, 0)
        counts[prefix] = counts.get(prefix, 0) + 1
    return result


def ref_continuous_multiple(nums: list[int], divisor: int) -> bool:
    first = {0: -1}
    prefix = 0
    for index, value in enumerate(nums):
        prefix += value
        key = prefix if divisor == 0 else prefix % abs(divisor)
        if key in first:
            if index - first[key] >= 2:
                return True
        else:
            first[key] = index
    return False


def ref_asteroids(values: list[int]) -> list[int]:
    stack: list[int] = []
    for value in values:
        alive = True
        while alive and value < 0 and stack and stack[-1] > 0:
            if stack[-1] < -value:
                stack.pop()
            elif stack[-1] == -value:
                stack.pop()
                alive = False
            else:
                alive = False
        if alive:
            stack.append(value)
    return stack


def ref_decode_string(text: str) -> str:
    counts: list[int] = []
    pieces: list[str] = []
    current = ""
    number = 0
    for char in text:
        if char.isdigit():
            number = number * 10 + int(char)
        elif char == "[":
            counts.append(number)
            pieces.append(current)
            number = 0
            current = ""
        elif char == "]":
            current = pieces.pop() + current * counts.pop()
        else:
            current += char
    return current


def ref_k_closest(values: list[int], count: int, target: int) -> list[int]:
    return sorted(
        sorted(values, key=lambda value: (abs(value - target), value))[:count]
    )


def ref_min_subarray(target: int, nums: list[int]) -> int:
    left = 0
    total = 0
    best = len(nums) + 1
    for right, value in enumerate(nums):
        total += value
        while total >= target:
            best = min(best, right - left + 1)
            total -= nums[left]
            left += 1
    return 0 if best > len(nums) else best


def ref_flight_bookings(bookings: list[list[int]], flights: int) -> list[int]:
    diff = [0] * (flights + 1)
    for start, end, seats in bookings:
        diff[start - 1] += seats
        if end < flights:
            diff[end] -= seats
    for index in range(1, flights):
        diff[index] += diff[index - 1]
    return diff[:flights]


def ref_car_pooling(trips: list[list[int]], capacity: int) -> bool:
    events: list[tuple[int, int]] = []
    for passengers, start, end in trips:
        events.append((start, passengers))
        events.append((end, -passengers))
    load = 0
    for _, change in sorted(events, key=lambda event: (event[0], event[1])):
        load += change
        if load > capacity:
            return False
    return True


def ref_simplify_path(path: str) -> str:
    stack: list[str] = []
    for part in path.split("/"):
        if part in ("", "."):
            continue
        if part == "..":
            if stack:
                stack.pop()
        else:
            stack.append(part)
    return "/" + "/".join(stack)


def ref_compare_versions(first: str, second: str) -> int:
    left = [int(piece) for piece in first.split(".")]
    right = [int(piece) for piece in second.split(".")]
    for index in range(max(len(left), len(right))):
        a = left[index] if index < len(left) else 0
        b = right[index] if index < len(right) else 0
        if a != b:
            return 1 if a > b else -1
    return 0


def ref_bounded_max(nums: list[int], low: int, high: int) -> int:
    result = 0
    last_too_large = -1
    last_in_range = -1
    for index, value in enumerate(nums):
        if value > high:
            last_too_large = index
        if low <= value <= high:
            last_in_range = index
        result += max(0, last_in_range - last_too_large)
    return result


def ref_reduce_x(nums: list[int], target: int) -> int:
    wanted = sum(nums) - target
    if wanted == 0:
        return len(nums)
    prefix = 0
    first = {0: -1}
    longest = -1
    for index, value in enumerate(nums):
        prefix += value
        if prefix - wanted in first:
            longest = max(longest, index - first[prefix - wanted])
        first.setdefault(prefix, index)
    return -1 if longest < 0 else len(nums) - longest


def ref_bag_tokens(tokens: list[int], power: int) -> int:
    values = sorted(tokens)
    left, right = 0, len(values) - 1
    score = best = 0
    while left <= right and (power >= values[left] or score):
        if power >= values[left]:
            power -= values[left]
            left += 1
            score += 1
            best = max(best, score)
        else:
            power += values[right]
            right -= 1
            score -= 1
    return best


def ref_stone_game(alice: list[int], bob: list[int]) -> int:
    order = sorted(range(len(alice)), key=lambda i: alice[i] + bob[i], reverse=True)
    a = sum(alice[index] for turn, index in enumerate(order) if turn % 2 == 0)
    b = sum(bob[index] for turn, index in enumerate(order) if turn % 2 == 1)
    return (a > b) - (a < b)


def ref_nice_subarrays(nums: list[int], target: int) -> int:
    counts = {0: 1}
    odd = result = 0
    for value in nums:
        odd += value & 1
        result += counts.get(odd - target, 0)
        counts[odd] = counts.get(odd, 0) + 1
    return result


def ref_circular_sum(nums: list[int]) -> int:
    total = sum(nums)
    best_max = current_max = nums[0]
    best_min = current_min = nums[0]
    for value in nums[1:]:
        current_max = max(value, current_max + value)
        best_max = max(best_max, current_max)
        current_min = min(value, current_min + value)
        best_min = min(best_min, current_min)
    return best_max if best_max < 0 else max(best_max, total - best_min)


def ref_longest_difference(nums: list[int], difference: int) -> int:
    best: dict[int, int] = {}
    answer = 0
    for value in nums:
        best[value] = best.get(value - difference, 0) + 1
        answer = max(answer, best[value])
    return answer


def ref_first_missing(nums: list[int]) -> int:
    values = set(nums)
    candidate = 1
    while candidate in values:
        candidate += 1
    return candidate


def ref_candy(ratings: list[int]) -> int:
    if not ratings:
        return 0
    candies = [1] * len(ratings)
    for index in range(1, len(ratings)):
        if ratings[index] > ratings[index - 1]:
            candies[index] = candies[index - 1] + 1
    for index in range(len(ratings) - 2, -1, -1):
        if ratings[index] > ratings[index + 1]:
            candies[index] = max(candies[index], candies[index + 1] + 1)
    return sum(candies)


def ref_text_justify(words: list[str], width: int) -> list[str]:
    lines: list[str] = []
    index = 0
    while index < len(words):
        end = index + 1
        length = len(words[index])
        while end < len(words) and length + 1 + len(words[end]) <= width:
            length += 1 + len(words[end])
            end += 1
        row = words[index:end]
        if end == len(words) or len(row) == 1:
            line = " ".join(row).ljust(width)
        else:
            letters = sum(map(len, row))
            spaces = width - letters
            gaps = len(row) - 1
            base, extra = divmod(spaces, gaps)
            line = (
                "".join(
                    word + (" " * (base + (gap < extra)))
                    for gap, word in enumerate(row[:-1])
                )
                + row[-1]
            )
        lines.append(line)
        index = end
    return lines


def ref_longest_valid(text: str) -> int:
    stack = [-1]
    best = 0
    for index, char in enumerate(text):
        if char == "(":
            stack.append(index)
        else:
            stack.pop()
            if stack:
                best = max(best, index - stack[-1])
            else:
                stack.append(index)
    return best


def ref_max_rectangle(matrix: list[list[int]]) -> int:
    if not matrix:
        return 0
    heights = [0] * len(matrix[0])
    answer = 0
    for row in matrix:
        heights = [height + 1 if value else 0 for height, value in zip(heights, row)]
        stack: list[tuple[int, int]] = []
        for index, height in enumerate(heights + [0]):
            start = index
            while stack and stack[-1][1] > height:
                position, previous = stack.pop()
                answer = max(answer, previous * (index - position))
                start = position
            stack.append((start, height))
    return answer


def ref_scramble(first: str, second: str) -> bool:
    @lru_cache(None)
    def visit(a: str, b: str) -> bool:
        if a == b:
            return True
        if Counter(a) != Counter(b):
            return False
        return any(
            (visit(a[:cut], b[:cut]) and visit(a[cut:], b[cut:]))
            or (visit(a[:cut], b[-cut:]) and visit(a[cut:], b[:-cut]))
            for cut in range(1, len(a))
        )

    return len(first) == len(second) and visit(first, second)


def ref_stock_three(prices: list[int]) -> int:
    buy_one = buy_two = -(10**18)
    sell_one = sell_two = 0
    for price in prices:
        buy_one = max(buy_one, -price)
        sell_one = max(sell_one, buy_one + price)
        buy_two = max(buy_two, sell_one - price)
        sell_two = max(sell_two, buy_two + price)
    return sell_two


def ref_stock_four(transactions: int, prices: list[int]) -> int:
    if transactions <= 0 or not prices:
        return 0
    if transactions >= len(prices) // 2:
        return sum(max(0, b - a) for a, b in pairwise(prices))
    buy = [-(10**18)] * (transactions + 1)
    sell = [0] * (transactions + 1)
    for price in prices:
        for count in range(1, transactions + 1):
            buy[count] = max(buy[count], sell[count - 1] - price)
            sell[count] = max(sell[count], buy[count] + price)
    return sell[transactions]


def ref_dungeon(grid: list[list[int]]) -> int:
    rows, columns = len(grid), len(grid[0])
    needed = [[10**18] * (columns + 1) for _ in range(rows + 1)]
    needed[rows][columns - 1] = needed[rows - 1][columns] = 1
    for row in range(rows - 1, -1, -1):
        for column in range(columns - 1, -1, -1):
            needed[row][column] = max(
                1,
                min(needed[row + 1][column], needed[row][column + 1])
                - grid[row][column],
            )
    return needed[0][0]


def ref_shortest_palindrome(text: str) -> str:
    combined = text + "#" + text[::-1]
    prefix = [0] * len(combined)
    for index in range(1, len(combined)):
        match = prefix[index - 1]
        while match and combined[index] != combined[match]:
            match = prefix[match - 1]
        if combined[index] == combined[match]:
            match += 1
        prefix[index] = match
    return text[prefix[-1] :][::-1] + text


def ref_count_smaller(nums: list[int]) -> list[int]:
    ordered = sorted(set(nums))
    tree = [0] * (len(ordered) + 1)

    def add(index: int):
        index += 1
        while index < len(tree):
            tree[index] += 1
            index += index & -index

    def query(index: int) -> int:
        total = 0
        while index:
            total += tree[index]
            index -= index & -index
        return total

    result: list[int] = []
    for value in reversed(nums):
        rank = bisect_left(ordered, value)
        result.append(query(rank))
        add(rank)
    return result[::-1]


def ref_russian_dolls(envelopes: list[list[int]]) -> int:
    tails: list[int] = []
    for _, height in sorted(envelopes, key=lambda pair: (pair[0], -pair[1])):
        index = bisect_left(tails, height)
        if index == len(tails):
            tails.append(height)
        else:
            tails[index] = height
    return len(tails)


def ref_split_array(nums: list[int], parts: int) -> int:
    low, high = max(nums), sum(nums)
    while low < high:
        middle = (low + high) // 2
        used = 1
        total = 0
        for value in nums:
            if total + value > middle:
                used += 1
                total = 0
            total += value
        if used <= parts:
            high = middle
        else:
            low = middle + 1
    return low


def ref_trap_rain(grid: list[list[int]]) -> int:
    rows, columns = len(grid), len(grid[0])
    if rows < 3 or columns < 3:
        return 0
    visited = [[False] * columns for _ in range(rows)]
    heap: list[tuple[int, int, int]] = []
    for row in range(rows):
        for column in (0, columns - 1):
            if not visited[row][column]:
                visited[row][column] = True
                heappush(heap, (grid[row][column], row, column))
    for column in range(columns):
        for row in (0, rows - 1):
            if not visited[row][column]:
                visited[row][column] = True
                heappush(heap, (grid[row][column], row, column))
    water = 0
    for_height = ((1, 0), (-1, 0), (0, 1), (0, -1))
    while heap:
        height, row, column = heappop(heap)
        for row_delta, column_delta in for_height:
            next_row, next_column = row + row_delta, column + column_delta
            if (
                0 <= next_row < rows
                and 0 <= next_column < columns
                and not visited[next_row][next_column]
            ):
                visited[next_row][next_column] = True
                next_height = grid[next_row][next_column]
                water += max(0, height - next_height)
                heappush(heap, (max(height, next_height), next_row, next_column))
    return water


def ref_strange_printer(text: str) -> int:
    compressed = "".join(
        char for index, char in enumerate(text) if index == 0 or char != text[index - 1]
    )
    if not compressed:
        return 0

    @lru_cache(None)
    def visit(left: int, right: int) -> int:
        if left > right:
            return 0
        answer = 1 + visit(left + 1, right)
        for split in range(left + 1, right + 1):
            if compressed[split] == compressed[left]:
                answer = min(answer, visit(left + 1, split - 1) + visit(split, right))
        return answer

    return visit(0, len(compressed) - 1)


def ref_inverse_pairs(length: int, target: int) -> int:
    dp = [1] + [0] * target
    for number in range(1, length + 1):
        prefix = 0
        next_dp = [0] * (target + 1)
        for inversions in range(target + 1):
            prefix += dp[inversions]
            if inversions >= number:
                prefix -= dp[inversions - number]
            next_dp[inversions] = prefix % MOD
        dp = next_dp
    return dp[target]


def ref_stay_in_place(steps: int, length: int) -> int:
    width = min(length, steps // 2 + 1)
    dp = [0] * width
    dp[0] = 1
    for _ in range(steps):
        next_dp = [0] * width
        for index, value in enumerate(dp):
            for next_index in (index - 1, index, index + 1):
                if 0 <= next_index < width:
                    next_dp[next_index] = (next_dp[next_index] + value) % MOD
        dp = next_dp
    return dp[0]


def ref_job_difficulty(jobs: list[int], days: int) -> int:
    if len(jobs) < days:
        return -1
    dp = jobs[:]
    for index in range(len(jobs) - 2, -1, -1):
        dp[index] = max(dp[index], dp[index + 1])
    for day in range(2, days + 1):
        next_dp = [10**18] * len(jobs)
        for start in range(len(jobs) - day + 1):
            hardest = 0
            for end in range(start, len(jobs) - day + 1):
                hardest = max(hardest, jobs[end])
                next_dp[start] = min(next_dp[start], hardest + dp[end + 1])
        dp = next_dp
    return dp[0]


def ref_team_performance(
    count: int, speed: list[int], efficiency: list[int], team: int
) -> int:
    del count
    heap: list[int] = []
    speed_sum = 0
    best = 0
    for current_efficiency, current_speed in sorted(
        zip(efficiency, speed), reverse=True
    ):
        heappush(heap, current_speed)
        speed_sum += current_speed
        if len(heap) > team:
            speed_sum -= heappop(heap)
        best = max(best, speed_sum * current_efficiency)
    return best % MOD


def ref_min_taps(length: int, ranges: list[int]) -> int:
    reach = [0] * (length + 1)
    for center, radius in enumerate(ranges):
        start = max(0, center - radius)
        reach[start] = max(reach[start], min(length, center + radius))
    taps = 0
    current_end = farthest = 0
    for position in range(length):
        farthest = max(farthest, reach[position])
        if position == current_end:
            if farthest <= position:
                return -1
            taps += 1
            current_end = farthest
    return taps


def cases_merge_strings():
    pairs = [("", ""), ("a", ""), ("", "z"), ("ab", "pqrs"), ("abcd", "xy")]
    return unique_twenty(
        pairs, lambda i: (WORDS[i % len(WORDS)], WORDS[(i * 7 + 3) % len(WORDS)])
    )


def cases_pivot():
    seeds = [([1, 7, 3, 6, 5, 6],), ([1, 2, 3],), ([2, 1, -1],)]
    return unique_twenty(seeds, lambda i: (ARRAYS[i % len(ARRAYS)],))


def cases_subsequence():
    seeds = [("", "abc"), ("abc", "ahbgdc"), ("axc", "ahbgdc"), ("aaaa", "aa")]
    return unique_twenty(seeds, lambda i: (WORDS[i % 16], WORDS[(i * 5 + 7) % 16] * 2))


def cases_square():
    values = [
        -1,
        0,
        1,
        2,
        4,
        8,
        9,
        15,
        16,
        25,
        26,
        81,
        99,
        100,
        121,
        144,
        2147395600,
        2147395601,
        99980001,
        10**9,
    ]
    return tuple((value,) for value in values)


def cases_max_words():
    seeds = [([],), (["hello"],), (["one two", "three four five"],)]
    return unique_twenty(
        seeds,
        lambda i: ([" ".join([f"w{i}"] * count) for count in range(1, (i % 5) + 2)],),
    )


def cases_find_difference():
    seeds = [("", "x"), ("abcd", "abcde"), ("a", "aa")]
    return unique_twenty(
        seeds,
        lambda i: (
            "".join(sorted(WORDS[(i * 3) % 15])),
            "".join(sorted(WORDS[(i * 3) % 15] + chr(97 + i % 26))),
        ),
    )


def cases_anagrams():
    seeds = [("cbaebabacd", "abc"), ("abab", "ab"), ("a", "ab"), ("", "a")]
    return unique_twenty(
        seeds,
        lambda i: (
            WORDS[(i * 7 + 4) % 15] * (1 + i % 2),
            WORDS[(i * 3 + 2) % 5] or "a",
        ),
    )


def cases_subarray_sum():
    seeds = [([1, 1, 1], 2), ([1, 2, 3], 3), ([], 0)]
    return unique_twenty(seeds, lambda i: (ARRAYS[i % len(ARRAYS)], (i % 9) - 4))


def cases_continuous():
    seeds = [([23, 2, 4, 6, 7], 6), ([23, 2, 6, 4, 7], 13), ([0, 0], 0)]
    return unique_twenty(
        seeds, lambda i: ([abs(value) for value in ARRAYS[i % len(ARRAYS)]], (i % 7))
    )


def cases_asteroids():
    seeds = [([5, 10, -5],), ([8, -8],), ([10, 2, -5],), ([-2, -1, 1, 2],)]
    return unique_twenty(
        seeds, lambda i: ([value or 1 for value in ARRAYS[i % len(ARRAYS)]],)
    )


def cases_decode():
    values = [
        "a",
        "3[a]2[bc]",
        "3[a2[c]]",
        "2[abc]3[cd]ef",
        "10[x]",
        "2[a2[b]c]",
        "1[z]",
        "2[ab3[c]]",
        "3[x2[y]]z",
        "2[pq]r",
        "4[a]",
        "2[2[a]]",
        "abc3[de]",
        "2[a]2[b]2[c]",
        "5[z]y",
        "3[a1[b]]",
        "2[m3[n]]",
        "1[a2[b3[c]]]",
        "6[q]",
        "2[xyz]",
    ]
    return tuple((value,) for value in values)


def cases_k_closest():
    seeds = [([1, 2, 3, 4, 5], 4, 3), ([1, 2, 3, 4, 5], 4, -1)]
    return unique_twenty(
        seeds,
        lambda i: (
            sorted(set(ARRAYS[(i + 9) % len(ARRAYS)])) or [0],
            1 + i % max(1, len(set(ARRAYS[(i + 9) % len(ARRAYS)]))),
            (i % 11) - 5,
        ),
    )


def cases_min_subarray():
    seeds = [(7, [2, 3, 1, 2, 4, 3]), (4, [1, 4, 4]), (11, [1, 1, 1, 1])]
    return unique_twenty(
        seeds,
        lambda i: (
            1 + (i * 7) % 25,
            [abs(value) + 1 for value in ARRAYS[(i + 4) % len(ARRAYS)]],
        ),
    )


def cases_bookings():
    seeds = [([[1, 2, 10], [2, 3, 20], [2, 5, 25]], 5), ([], 1)]

    def factory(i: int):
        flights = 1 + i % 8
        bookings = []
        for j in range(1 + i % 5):
            start = 1 + (i + j) % flights
            end = start + (i * 2 + j) % (flights - start + 1)
            bookings.append([start, end, 1 + (i * 7 + j * 3) % 30])
        return bookings, flights

    return unique_twenty(seeds, factory)


def cases_car_pooling():
    seeds = [([[2, 1, 5], [3, 3, 7]], 4), ([[2, 1, 5], [3, 3, 7]], 5), ([], 1)]

    def factory(i: int):
        trips = []
        for j in range(1 + i % 5):
            start = (i + j * 2) % 8
            end = start + 1 + (i + j) % 5
            trips.append([1 + (i + j) % 4, start, end])
        return trips, 1 + (i * 3) % 10

    return unique_twenty(seeds, factory)


def cases_paths():
    values = [
        "/",
        "/home/",
        "/../",
        "/home//foo/",
        "/a/./b/../../c/",
        "/a/../../b/../c//.//",
        "/.../a/../b",
        "/a/b/c/..",
        "/././",
        "/x//y///z",
        "/a/b/../../../",
        "/a/.hidden/",
        "/a/.../",
        "/a/../a/../a",
        "/one/two/../../three",
        "/a/b/./c/",
        "/../../x",
        "/a//b//..//c",
        "/dot/./dot",
        "/end/..",
    ]
    return tuple((value,) for value in values)


def cases_versions():
    seeds = [("1.01", "1.001"), ("1.0", "1.0.0"), ("0.1", "1.1"), ("1.0.1", "1")]
    return unique_twenty(
        seeds, lambda i: (f"{i % 4}.{i * 3 % 10}.{i % 2}", f"{i % 5}.{i * 7 % 10}")
    )


def cases_bounded():
    seeds = [([2, 1, 4, 3], 2, 3), ([2, 9, 2, 5, 6], 2, 8)]
    return unique_twenty(
        seeds,
        lambda i: ([abs(value) for value in ARRAYS[i % len(ARRAYS)]], i % 4, 4 + i % 6),
    )


def cases_reduce_x():
    seeds = [([1, 1, 4, 2, 3], 5), ([5, 6, 7, 8, 9], 4), ([3, 2, 20, 1, 1, 3], 10)]
    return unique_twenty(
        seeds,
        lambda i: (
            [abs(value) + 1 for value in ARRAYS[(i + 5) % len(ARRAYS)]] or [1],
            1 + (i * 5) % 30,
        ),
    )


def cases_tokens():
    seeds = [([], 50), ([100], 50), ([100, 200], 150), ([100, 200, 300, 400], 200)]
    return unique_twenty(
        seeds,
        lambda i: (
            [10 + abs(value) * 10 for value in ARRAYS[(i + 3) % len(ARRAYS)]],
            (i * 37) % 250,
        ),
    )


def cases_stone_game():
    seeds = [([1, 3], [2, 1]), ([1, 2], [3, 1]), ([2, 4, 3], [1, 6, 7])]

    def factory(i: int):
        size = 1 + i % 7
        return (
            [1 + (i * 3 + j * 5) % 10 for j in range(size)],
            [1 + (i * 7 + j * 2) % 10 for j in range(size)],
        )

    return unique_twenty(seeds, factory)


def cases_nice():
    seeds = [([1, 1, 2, 1, 1], 3), ([2, 4, 6], 1), ([2, 2, 2, 1, 2, 2], 1)]
    return unique_twenty(
        seeds,
        lambda i: ([abs(value) for value in ARRAYS[(i + 2) % len(ARRAYS)]], 1 + i % 4),
    )


def cases_difference():
    seeds = [([1, 2, 3, 4], 1), ([1, 3, 5, 7], 1), ([1, 5, 7, 8, 5, 3, 4, 2, 1], -2)]
    return unique_twenty(
        seeds, lambda i: (ARRAYS[(i + 12) % len(ARRAYS)] or [0], (i % 7) - 3)
    )


def cases_text_justify():
    seeds = [
        (["This", "is", "an", "example", "of", "text", "justification."], 16),
        (["a"], 1),
    ]
    word_pool = ["alpha", "b", "gamma", "delta", "pi", "market", "risk", "order", "x"]

    def factory(i: int):
        width = 8 + i % 13
        words = [word_pool[(i + j * 3) % len(word_pool)] for j in range(1 + i % 8)]
        words = [word[:width] for word in words]
        return words, width

    return unique_twenty(seeds, factory)


def cases_parentheses():
    values = [
        "",
        "(",
        ")",
        "()",
        "(()",
        ")()())",
        "()(())",
        "(()())",
        "())((())",
        "((()))",
        "()()",
        "((((",
        "))))",
        "(()(()",
        "())()()",
        "((())())",
        "()(()))))",
        "(()())()",
        ")((()))(",
        "((()()))()",
    ]
    return tuple((value,) for value in values)


def cases_binary_matrix():
    seeds = [([[1]],), ([[0]],), ([[1, 0], [1, 1]],), ([],)]

    def factory(i: int):
        rows = 1 + i % 5
        columns = 1 + (i * 3) % 6
        return (
            [
                [
                    1 if (row * 3 + column * 5 + i) % 4 else 0
                    for column in range(columns)
                ]
                for row in range(rows)
            ],
        )

    return unique_twenty(seeds, factory)


def cases_scramble():
    return (
        ("great", "rgeat"),
        ("abcde", "caebd"),
        ("a", "a"),
        ("abc", "bca"),
        ("ab", "ba"),
        ("abc", "cba"),
        ("abcd", "badc"),
        ("aabb", "bbaa"),
        ("algorithm", "algorithm"),
        ("abc", "acb"),
        ("abcd", "cadb"),
        ("abcde", "edcba"),
        ("aabbcc", "ccbbaa"),
        ("abab", "baba"),
        ("abcabc", "bcabca"),
        ("great", "rgtae"),
        ("abcdef", "efabcd"),
        ("aaaaab", "baaaaa"),
        ("cabacaba", "abacacab"),
        ("leetcode", "codeleet"),
    )


def cases_stock():
    seeds = [
        ([],),
        ([1],),
        ([3, 3, 5, 0, 0, 3, 1, 4],),
        ([1, 2, 3, 4, 5],),
        ([7, 6, 4, 3, 1],),
    ]
    return unique_twenty(
        seeds, lambda i: ([abs(value) for value in ARRAYS[(i + 6) % len(ARRAYS)]],)
    )


def cases_stock_four():
    seeds = [(2, [2, 4, 1]), (2, [3, 2, 6, 5, 0, 3]), (0, [1, 2])]
    return unique_twenty(
        seeds,
        lambda i: (i % 5, [abs(value) for value in ARRAYS[(i + 7) % len(ARRAYS)]]),
    )


def cases_dungeon():
    seeds = [
        ([[-2, -3, 3], [-5, -10, 1], [10, 30, -5]],),
        ([[0]],),
        ([[100]],),
        ([[-5]],),
    ]

    def factory(i: int):
        rows = 1 + i % 4
        columns = 1 + (i * 3) % 4
        return (
            [
                [((row * 7 + column * 3 + i * 5) % 17) - 8 for column in range(columns)]
                for row in range(rows)
            ],
        )

    return unique_twenty(seeds, factory)


def cases_count_smaller():
    seeds = [([5, 2, 6, 1],), ([-1],), ([-1, -1],)]
    return unique_twenty(seeds, lambda i: (ARRAYS[(i + 8) % len(ARRAYS)],))


def cases_envelopes():
    seeds = [([[5, 4], [6, 4], [6, 7], [2, 3]],), ([[1, 1], [1, 1]],)]

    def factory(i: int):
        size = 1 + i % 9
        return (
            [[1 + (i * 3 + j * 2) % 12, 1 + (i * 7 + j * 5) % 12] for j in range(size)],
        )

    return unique_twenty(seeds, factory)


def cases_split():
    seeds = [([7, 2, 5, 10, 8], 2), ([1, 2, 3, 4, 5], 2), ([1, 4, 4], 3)]
    return unique_twenty(
        seeds,
        lambda i: (
            [abs(value) for value in ARRAYS[(i + 9) % len(ARRAYS)]] or [0],
            1 + i % max(1, len(ARRAYS[(i + 9) % len(ARRAYS)])),
        ),
    )


def cases_heights():
    seeds = [([[1, 4, 3, 1, 3, 2], [3, 2, 1, 3, 2, 4], [2, 3, 3, 2, 3, 1]],), ([[1]],)]

    def factory(i: int):
        rows = 1 + i % 5
        columns = 1 + (i * 2) % 6
        return (
            [
                [1 + (row * 7 + column * 3 + i) % 9 for column in range(columns)]
                for row in range(rows)
            ],
        )

    return unique_twenty(seeds, factory)


def cases_inverse_pairs():
    seeds = [(1, 0), (3, 0), (3, 1), (3, 3), (4, 2)]
    return unique_twenty(seeds, lambda i: (1 + i % 12, (i * 7) % 25))


def cases_stay():
    seeds = [(3, 2), (2, 4), (4, 2), (1, 1)]
    return unique_twenty(seeds, lambda i: (1 + i % 18, 1 + (i * 5) % 12))


def cases_jobs():
    seeds = [
        ([6, 5, 4, 3, 2, 1], 2),
        ([9, 9, 9], 4),
        ([1, 1, 1], 3),
        ([7, 1, 7, 1, 7, 1], 3),
    ]
    return unique_twenty(
        seeds,
        lambda i: (
            [1 + abs(value) for value in ARRAYS[(i + 4) % len(ARRAYS)]] or [1],
            1 + i % 6,
        ),
    )


def cases_performance():
    seeds = [
        (6, [2, 10, 3, 1, 5, 8], [5, 4, 3, 9, 7, 2], 2),
        (3, [2, 8, 2], [2, 7, 1], 2),
    ]

    def factory(i: int):
        count = 1 + i % 8
        speed = [1 + (i * 3 + j * 5) % 15 for j in range(count)]
        efficiency = [1 + (i * 7 + j * 2) % 12 for j in range(count)]
        return count, speed, efficiency, 1 + i % count

    return unique_twenty(seeds, factory)


def cases_taps():
    seeds = [(5, [3, 4, 1, 1, 0, 0]), (3, [0, 0, 0, 0]), (0, [0])]

    def factory(i: int):
        length = 1 + i % 12
        return length, [(i * 3 + position * 5) % 5 for position in range(length + 1)]

    return unique_twenty(seeds, factory)


def simple_array_cases(
    seed: list[tuple[Json, ...]] | None = None,
    *,
    positive: bool = False,
    nonempty: bool = False,
):
    def factory(i: int):
        values = ARRAYS[i % len(ARRAYS)]
        if positive:
            values = [abs(value) + 1 for value in values]
        if nonempty and not values:
            values = [i + 1]
        return (values,)

    return unique_twenty(seed or [], factory)


PROBLEMS = (
    Problem(
        1768,
        "merge-strings-alternately",
        "Merge Strings Alternately",
        "Easy",
        ("Two Pointers", "String"),
        "Interleave two strings one character at a time, appending the unused suffix of the longer input.",
        ("Inputs may be empty.", "Preserve the order within each source string."),
        (("word1", "String"), ("word2", "String")),
        "String",
        ref_merge_strings,
        cases_merge_strings(),
    ),
    Problem(
        724,
        "find-pivot-index",
        "Find Pivot Index",
        "Easy",
        ("Array", "Prefix Sum"),
        "Return the first index whose left-side sum equals its right-side sum, excluding the value at the index.",
        ("Return -1 when no balance point exists.", "Negative values are allowed."),
        (("nums", "int[]"),),
        "int",
        ref_pivot,
        cases_pivot(),
    ),
    Problem(
        392,
        "is-subsequence",
        "Is Subsequence",
        "Easy",
        ("Two Pointers", "String"),
        "Determine whether every character of the first string appears in order inside the second string.",
        (
            "Characters need not be adjacent.",
            "The empty string is a subsequence of every string.",
        ),
        (("candidate", "String"), ("text", "String")),
        "boolean",
        ref_subsequence,
        cases_subsequence(),
    ),
    Problem(
        367,
        "valid-perfect-square",
        "Valid Perfect Square",
        "Easy",
        ("Math", "Binary Search"),
        "Decide whether an integer is the square of another integer without using floating-point square roots.",
        ("Negative values are not perfect squares.", "Zero is a perfect square."),
        (("value", "int"),),
        "boolean",
        ref_perfect_square,
        cases_square(),
    ),
    Problem(
        2114,
        "maximum-number-of-words-found-in-sentences",
        "Maximum Words in a Sentence",
        "Easy",
        ("Array", "String"),
        "Given several space-delimited sentences, return the largest word count among them.",
        (
            "An empty collection has maximum zero.",
            "Words are separated by ordinary whitespace.",
        ),
        (("sentences", "String[]"),),
        "int",
        ref_max_words,
        cases_max_words(),
    ),
    Problem(
        1346,
        "check-if-n-and-its-double-exist",
        "Check If a Double Exists",
        "Easy",
        ("Array", "Hash Table"),
        "Report whether two different positions contain values where one is exactly twice the other.",
        (
            "The two positions must be distinct.",
            "Zero needs two occurrences to pair with itself.",
        ),
        (("nums", "int[]"),),
        "boolean",
        ref_double_exists,
        simple_array_cases(),
    ),
    Problem(
        389,
        "find-the-difference",
        "Find the Added Character",
        "Easy",
        ("String", "Bit Manipulation"),
        "One string is a shuffled copy of another with one extra character; return that extra character.",
        ("Characters may repeat.", "The second input is exactly one character longer."),
        (("original", "String"), ("changed", "String")),
        "String",
        ref_find_difference,
        cases_find_difference(),
    ),
    Problem(
        283,
        "move-zeroes",
        "Move Zeroes",
        "Easy",
        ("Array", "Two Pointers"),
        "Return the array with nonzero values kept in order and every zero moved to the end.",
        (
            "Preserve the relative order of nonzero values.",
            "Return a transformed array for this practice version.",
        ),
        (("nums", "int[]"),),
        "int[]",
        ref_move_zeroes,
        simple_array_cases(),
    ),
    Problem(
        896,
        "monotonic-array",
        "Monotonic Array",
        "Easy",
        ("Array",),
        "Determine whether the sequence is entirely nondecreasing or entirely nonincreasing.",
        (
            "Equal adjacent values are allowed.",
            "Arrays shorter than two values are monotonic.",
        ),
        (("nums", "int[]"),),
        "boolean",
        ref_monotonic,
        simple_array_cases(),
    ),
    Problem(
        697,
        "degree-of-an-array",
        "Shortest Degree-Preserving Subarray",
        "Easy",
        ("Array", "Hash Table"),
        "Return the shortest contiguous length that has the same maximum frequency as the full array.",
        (
            "Return zero for an empty array in this practice version.",
            "Ties use the shortest span.",
        ),
        (("nums", "int[]"),),
        "int",
        ref_degree,
        simple_array_cases(),
    ),
    Problem(
        75,
        "sort-colors",
        "Sort Three Colors",
        "Medium",
        ("Array", "Two Pointers"),
        "Arrange an array containing only 0, 1, and 2 in ascending color order.",
        ("Return the arranged array.", "Inputs contain only the three color codes."),
        (("colors", "int[]"),),
        "int[]",
        ref_sort_colors,
        unique_twenty(
            [([],), ([0],), ([2, 0, 2, 1, 1, 0],)],
            lambda i: ([((i // (j + 1)) + j * j + i) % 3 for j in range(1 + i % 20)],),
        ),
    ),
    Problem(
        845,
        "longest-mountain-in-array",
        "Longest Mountain",
        "Medium",
        ("Array", "Two Pointers"),
        "Find the longest contiguous run that strictly rises to one peak and then strictly falls.",
        (
            "A mountain needs at least three values.",
            "Plateaus do not belong to a mountain.",
        ),
        (("nums", "int[]"),),
        "int",
        ref_longest_mountain,
        simple_array_cases(),
    ),
    Problem(
        438,
        "find-all-anagrams-in-a-string",
        "Find All Anagram Starts",
        "Medium",
        ("String", "Sliding Window"),
        "Return every start index where a substring is a permutation of the pattern.",
        (
            "Return indexes in ascending order.",
            "An empty or longer pattern has no matches.",
        ),
        (("text", "String"), ("pattern", "String")),
        "int[]",
        ref_find_anagrams,
        cases_anagrams(),
    ),
    Problem(
        560,
        "subarray-sum-equals-k",
        "Count Subarrays With Target Sum",
        "Medium",
        ("Array", "Prefix Sum"),
        "Count contiguous subarrays whose values add exactly to the target.",
        (
            "Values and the target may be negative.",
            "Count overlapping subarrays separately.",
        ),
        (("nums", "int[]"), ("target", "int")),
        "int",
        ref_subarray_sum,
        cases_subarray_sum(),
    ),
    Problem(
        523,
        "continuous-subarray-sum",
        "Continuous Multiple Sum",
        "Medium",
        ("Array", "Prefix Sum"),
        "Determine whether a contiguous subarray of length at least two has a sum divisible by the divisor.",
        (
            "A zero divisor asks for an exact zero sum.",
            "The chosen span must contain at least two values.",
        ),
        (("nums", "int[]"), ("divisor", "int")),
        "boolean",
        ref_continuous_multiple,
        cases_continuous(),
    ),
    Problem(
        735,
        "asteroid-collision",
        "Asteroid Collision",
        "Medium",
        ("Array", "Stack", "Simulation"),
        "Simulate one-dimensional asteroids; opposite-moving neighbors collide and the smaller magnitude disappears.",
        (
            "Equal opposing magnitudes destroy both.",
            "Return survivors in their final order.",
        ),
        (("asteroids", "int[]"),),
        "int[]",
        ref_asteroids,
        cases_asteroids(),
    ),
    Problem(
        394,
        "decode-string",
        "Decode Repeated String",
        "Medium",
        ("String", "Stack"),
        "Expand nested count[segment] expressions into their decoded string.",
        (
            "Repeat counts may contain multiple digits.",
            "Encoded segments may be nested.",
        ),
        (("encoded", "String"),),
        "String",
        ref_decode_string,
        cases_decode(),
    ),
    Problem(
        658,
        "find-k-closest-elements",
        "K Closest Sorted Values",
        "Medium",
        ("Array", "Binary Search"),
        "Choose the requested number of values nearest to a target and return those values sorted.",
        (
            "Break equal-distance ties toward the smaller value.",
            "The input array is sorted.",
        ),
        (("values", "int[]"), ("count", "int"), ("target", "int")),
        "int[]",
        ref_k_closest,
        cases_k_closest(),
    ),
    Problem(
        209,
        "minimum-size-subarray-sum",
        "Minimum Positive Window",
        "Medium",
        ("Array", "Sliding Window"),
        "Return the shortest contiguous length whose positive values total at least the target.",
        ("Return zero when no qualifying window exists.", "Input values are positive."),
        (("target", "int"), ("nums", "int[]")),
        "int",
        ref_min_subarray,
        cases_min_subarray(),
    ),
    Problem(
        1109,
        "corporate-flight-bookings",
        "Range Flight Bookings",
        "Medium",
        ("Array", "Prefix Sum"),
        "Apply inclusive range seat additions and return the final reserved seats for every numbered flight.",
        ("Booking indexes are one-based.", "Ranges include both endpoints."),
        (("bookings", "int[][]"), ("flights", "int")),
        "int[]",
        ref_flight_bookings,
        cases_bookings(),
    ),
    Problem(
        1094,
        "car-pooling",
        "Car Pool Capacity",
        "Medium",
        ("Prefix Sum", "Simulation"),
        "Given pickup and drop-off events along a route, decide whether passenger load ever exceeds capacity.",
        (
            "Passengers leave before new passengers board at the same location.",
            "Trips use [passengers, start, end].",
        ),
        (("trips", "int[][]"), ("capacity", "int")),
        "boolean",
        ref_car_pooling,
        cases_car_pooling(),
    ),
    Problem(
        71,
        "simplify-path",
        "Simplify Absolute Path",
        "Medium",
        ("String", "Stack"),
        "Normalize an absolute Unix-style path by resolving separators, current-directory markers, and parent-directory markers.",
        (
            "The result starts with one slash.",
            "Parent navigation cannot move above root.",
        ),
        (("path", "String"),),
        "String",
        ref_simplify_path,
        cases_paths(),
    ),
    Problem(
        165,
        "compare-version-numbers",
        "Compare Version Numbers",
        "Medium",
        ("Two Pointers", "String"),
        "Compare dot-separated numeric revisions after ignoring leading zeroes and missing trailing zero components.",
        ("Return -1, 0, or 1.", "Each revision component is nonnegative."),
        (("first", "String"), ("second", "String")),
        "int",
        ref_compare_versions,
        cases_versions(),
    ),
    Problem(
        795,
        "number-of-subarrays-with-bounded-maximum",
        "Count Windows With Bounded Maximum",
        "Medium",
        ("Array", "Two Pointers"),
        "Count contiguous subarrays whose maximum lies inside the inclusive lower and upper bounds.",
        (
            "Count each distinct index range.",
            "The lower bound does not exceed the upper bound.",
        ),
        (("nums", "int[]"), ("low", "int"), ("high", "int")),
        "int",
        ref_bounded_max,
        cases_bounded(),
    ),
    Problem(
        1658,
        "minimum-operations-to-reduce-x-to-zero",
        "Reduce Target From Array Ends",
        "Medium",
        ("Array", "Sliding Window"),
        "Remove values from either end until their sum equals the target, minimizing removals.",
        ("Return -1 when impossible.", "Input values are positive."),
        (("nums", "int[]"), ("target", "int")),
        "int",
        ref_reduce_x,
        cases_reduce_x(),
    ),
    Problem(
        948,
        "bag-of-tokens",
        "Bag of Tokens Score",
        "Medium",
        ("Two Pointers", "Greedy"),
        "Spend power on tokens for score or trade score for power to maximize the highest score reached.",
        ("Each token may be used once.", "You may stop at any time."),
        (("tokens", "int[]"), ("power", "int")),
        "int",
        ref_bag_tokens,
        cases_tokens(),
    ),
    Problem(
        1686,
        "stone-game-vi",
        "Stone Game VI",
        "Medium",
        ("Greedy", "Sorting", "Game Theory"),
        "Two optimal players alternate selecting shared stones with player-specific values; report whether the first player wins, loses, or ties.",
        (
            "Return 1 for a first-player win, -1 for a loss, and 0 for a tie.",
            "Both value arrays have equal length.",
        ),
        (("aliceValues", "int[]"), ("bobValues", "int[]")),
        "int",
        ref_stone_game,
        cases_stone_game(),
    ),
    Problem(
        1248,
        "count-number-of-nice-subarrays",
        "Count Windows With K Odd Values",
        "Medium",
        ("Array", "Prefix Sum"),
        "Count contiguous subarrays containing exactly the requested number of odd values.",
        ("Even values may appear anywhere.", "The target is positive."),
        (("nums", "int[]"), ("target", "int")),
        "int",
        ref_nice_subarrays,
        cases_nice(),
    ),
    Problem(
        918,
        "maximum-sum-circular-subarray",
        "Maximum Circular Subarray",
        "Medium",
        ("Array", "Dynamic Programming"),
        "Return the largest sum of a nonempty contiguous span when the array's end connects to its beginning.",
        (
            "Use each position at most once.",
            "All-negative inputs choose their largest element.",
        ),
        (("nums", "int[]"),),
        "int",
        ref_circular_sum,
        simple_array_cases(nonempty=True),
    ),
    Problem(
        1218,
        "longest-arithmetic-subsequence-of-given-difference",
        "Longest Fixed-Difference Subsequence",
        "Medium",
        ("Array", "Hash Table", "Dynamic Programming"),
        "Return the longest subsequence where every adjacent pair differs by the supplied amount.",
        ("Keep original index order.", "The difference may be negative or zero."),
        (("nums", "int[]"), ("difference", "int")),
        "int",
        ref_longest_difference,
        cases_difference(),
    ),
    Problem(
        41,
        "first-missing-positive",
        "First Missing Positive",
        "Hard",
        ("Array", "Hash Table"),
        "Return the smallest positive integer absent from the array.",
        (
            "Negative values and duplicates may appear.",
            "The answer is at most length + 1.",
        ),
        (("nums", "int[]"),),
        "int",
        ref_first_missing,
        simple_array_cases(),
    ),
    Problem(
        135,
        "candy",
        "Candy Distribution",
        "Hard",
        ("Array", "Greedy"),
        "Assign at least one unit to each rating so higher-rated neighbors receive more, minimizing the total.",
        (
            "Only adjacent ratings impose comparisons.",
            "Equal neighbors need no ordering.",
        ),
        (("ratings", "int[]"),),
        "int",
        ref_candy,
        simple_array_cases(nonempty=True),
    ),
    Problem(
        68,
        "text-justification",
        "Text Justification",
        "Hard",
        ("Array", "String", "Simulation"),
        "Pack words into fixed-width lines and distribute interior spaces as evenly as possible, leaving the last line left-aligned.",
        (
            "Earlier gaps receive extra spaces when division is uneven.",
            "Every output line has exactly the requested width.",
        ),
        (("words", "String[]"), ("width", "int")),
        "String[]",
        ref_text_justify,
        cases_text_justify(),
    ),
    Problem(
        32,
        "longest-valid-parentheses",
        "Longest Valid Parentheses",
        "Hard",
        ("String", "Stack", "Dynamic Programming"),
        "Return the longest contiguous length that forms balanced parentheses.",
        ("Only '(' and ')' occur.", "The empty string has result zero."),
        (("text", "String"),),
        "int",
        ref_longest_valid,
        cases_parentheses(),
    ),
    Problem(
        85,
        "maximal-rectangle",
        "Maximal Binary Rectangle",
        "Hard",
        ("Matrix", "Monotonic Stack"),
        "Find the largest axis-aligned rectangle containing only ones in a binary matrix.",
        ("Return area, not coordinates.", "An empty matrix has area zero."),
        (("matrix", "int[][]"),),
        "int",
        ref_max_rectangle,
        cases_binary_matrix(),
    ),
    Problem(
        87,
        "scramble-string",
        "Scramble String",
        "Hard",
        ("String", "Dynamic Programming"),
        "Determine whether recursive binary splits and optional child swaps can transform the first string into the second.",
        ("Inputs must have equal length.", "Characters may repeat."),
        (("first", "String"), ("second", "String")),
        "boolean",
        ref_scramble,
        cases_scramble(),
    ),
    Problem(
        123,
        "best-time-to-buy-and-sell-stock-iii",
        "Stock Profit With Two Transactions",
        "Hard",
        ("Array", "Dynamic Programming"),
        "Return the best profit using at most two nonoverlapping buy-then-sell transactions.",
        ("Hold at most one share at a time.", "Transactions are optional."),
        (("prices", "int[]"),),
        "int",
        ref_stock_three,
        cases_stock(),
    ),
    Problem(
        188,
        "best-time-to-buy-and-sell-stock-iv",
        "Stock Profit With K Transactions",
        "Hard",
        ("Array", "Dynamic Programming"),
        "Return the best profit using at most the supplied number of buy-then-sell transactions.",
        ("A sale must follow its purchase.", "Hold at most one share at a time."),
        (("transactions", "int"), ("prices", "int[]")),
        "int",
        ref_stock_four,
        cases_stock_four(),
    ),
    Problem(
        174,
        "dungeon-game",
        "Minimum Dungeon Health",
        "Hard",
        ("Matrix", "Dynamic Programming"),
        "Find the minimum starting health needed to move right or down through a gain/loss grid while health always stays positive.",
        (
            "Start at the upper-left and finish at the lower-right.",
            "Health may increase or decrease in each cell.",
        ),
        (("dungeon", "int[][]"),),
        "int",
        ref_dungeon,
        cases_dungeon(),
    ),
    Problem(
        214,
        "shortest-palindrome",
        "Shortest Palindrome by Front Additions",
        "Hard",
        ("String", "KMP"),
        "Add the fewest characters to the front so the full string becomes a palindrome.",
        (
            "Return the resulting palindrome.",
            "The empty string is already a palindrome.",
        ),
        (("text", "String"),),
        "String",
        ref_shortest_palindrome,
        tuple((word,) for word in WORDS),
    ),
    Problem(
        315,
        "count-of-smaller-numbers-after-self",
        "Count Smaller Values to the Right",
        "Hard",
        ("Fenwick Tree", "Merge Sort"),
        "For every position, count later values that are strictly smaller.",
        ("Equal values do not count.", "Return one count per input position."),
        (("nums", "int[]"),),
        "int[]",
        ref_count_smaller,
        cases_count_smaller(),
    ),
    Problem(
        354,
        "russian-doll-envelopes",
        "Russian Doll Envelopes",
        "Hard",
        ("Sorting", "Longest Increasing Subsequence"),
        "Return the longest chain where both width and height strictly increase.",
        ("An envelope cannot rotate.", "Equal widths cannot nest."),
        (("envelopes", "int[][]"),),
        "int",
        ref_russian_dolls,
        cases_envelopes(),
    ),
    Problem(
        410,
        "split-array-largest-sum",
        "Split Array Largest Sum",
        "Hard",
        ("Binary Search", "Greedy"),
        "Split nonnegative values into exactly the requested number of nonempty contiguous parts while minimizing the largest part sum.",
        ("Preserve element order.", "Every position belongs to exactly one part."),
        (("nums", "int[]"), ("parts", "int")),
        "int",
        ref_split_array,
        cases_split(),
    ),
    Problem(
        407,
        "trapping-rain-water-ii",
        "Trapping Rain Water on a Grid",
        "Hard",
        ("Heap", "Matrix", "Breadth-First Search"),
        "Compute water retained by a two-dimensional elevation map after rain.",
        ("Water may escape through every boundary cell.", "Return total unit volume."),
        (("heights", "int[][]"),),
        "int",
        ref_trap_rain,
        cases_heights(),
    ),
    Problem(
        664,
        "strange-printer",
        "Strange Printer",
        "Hard",
        ("String", "Dynamic Programming"),
        "A printer can overwrite any contiguous interval with one repeated character; return the fewest turns needed for the target string.",
        (
            "Existing characters may be overwritten.",
            "One turn prints only one character.",
        ),
        (("text", "String"),),
        "int",
        ref_strange_printer,
        tuple((word,) for word in WORDS),
    ),
    Problem(
        629,
        "k-inverse-pairs-array",
        "K Inverse Pairs",
        "Hard",
        ("Dynamic Programming",),
        "Count permutations of 1 through n having exactly k inverse pairs, modulo 1,000,000,007.",
        (
            "An inverse pair has i < j and permutation[i] > permutation[j].",
            "Return zero when k is unattainable.",
        ),
        (("length", "int"), ("target", "int")),
        "int",
        ref_inverse_pairs,
        cases_inverse_pairs(),
    ),
    Problem(
        1269,
        "number-of-ways-to-stay-in-the-same-place-after-some-steps",
        "Ways to Return After Steps",
        "Hard",
        ("Dynamic Programming",),
        "Count step sequences that finish at index zero on a bounded line when each move goes left, stays, or goes right.",
        ("Never leave the array bounds.", "Return the count modulo 1,000,000,007."),
        (("steps", "int"), ("length", "int")),
        "int",
        ref_stay_in_place,
        cases_stay(),
    ),
    Problem(
        1335,
        "minimum-difficulty-of-a-job-schedule",
        "Minimum Job Schedule Difficulty",
        "Hard",
        ("Array", "Dynamic Programming"),
        "Partition ordered jobs across consecutive nonempty days, minimizing the sum of each day's hardest job.",
        ("Job order cannot change.", "Return -1 when there are fewer jobs than days."),
        (("jobs", "int[]"), ("days", "int")),
        "int",
        ref_job_difficulty,
        cases_jobs(),
    ),
    Problem(
        1383,
        "maximum-performance-of-a-team",
        "Maximum Team Performance",
        "Hard",
        ("Greedy", "Heap", "Sorting"),
        "Choose at most k workers to maximize total speed multiplied by the team's minimum efficiency.",
        (
            "Speed and efficiency arrays align by worker.",
            "Return the result modulo 1,000,000,007.",
        ),
        (
            ("count", "int"),
            ("speed", "int[]"),
            ("efficiency", "int[]"),
            ("teamSize", "int"),
        ),
        "int",
        ref_team_performance,
        cases_performance(),
    ),
    Problem(
        1326,
        "minimum-number-of-taps-to-open-to-water-a-garden",
        "Minimum Taps for a Garden",
        "Hard",
        ("Array", "Greedy"),
        "Each tap waters an interval around its position; return the fewest taps covering the full garden from zero through n.",
        (
            "Return -1 when complete coverage is impossible.",
            "The ranges array has n + 1 entries.",
        ),
        (("length", "int"), ("ranges", "int[]")),
        "int",
        ref_min_taps,
        cases_taps(),
    ),
)

PROBLEMS = (*PROBLEMS, *build_expansion(Problem, unique_twenty))


PYTHON_TYPES = {
    "int": "int",
    "long": "int",
    "boolean": "bool",
    "String": "str",
    "int[]": "list[int]",
    "String[]": "list[str]",
    "int[][]": "list[list[int]]",
}
CPP_TYPES = {
    "int": "int",
    "long": "long long",
    "boolean": "bool",
    "String": "string",
    "int[]": "vector<int>",
    "String[]": "vector<string>",
    "int[][]": "vector<vector<int>>",
}


def starter_code(problem: Problem) -> dict[str, str]:
    python_params = ", ".join(
        f"{name}: {PYTHON_TYPES[kind]}" for name, kind in problem.params
    )
    java_params = ", ".join(f"{kind} {name}" for name, kind in problem.params)
    cpp_params = ", ".join(f"{CPP_TYPES[kind]} {name}" for name, kind in problem.params)
    return {
        "python": (
            "class Solution:\n"
            f"    def solve(self, {python_params}) -> {PYTHON_TYPES[problem.return_type]}:\n"
            "        # Write your solution here.\n"
            "        raise NotImplementedError\n"
        ),
        "java": (
            "class Solution {\n"
            f"    public {problem.return_type} solve({java_params}) {{\n"
            "        // Write your solution here.\n"
            '        throw new UnsupportedOperationException("TODO");\n'
            "    }\n"
            "}\n"
        ),
        "cpp": (
            "class Solution {\n"
            "public:\n"
            f"    {CPP_TYPES[problem.return_type]} solve({cpp_params}) {{\n"
            "        // Write your solution here.\n"
            '        throw runtime_error("TODO");\n'
            "    }\n"
            "};\n"
        ),
    }


def serialize_problem(problem: Problem, include_cases: bool) -> dict[str, Any]:
    cases: list[dict[str, Any]] = []
    for index, arguments in enumerate(problem.cases):
        expected = problem.reference(*arguments)
        repeated = problem.reference(*json.loads(json.dumps(arguments)))
        if expected != repeated:
            raise AssertionError(
                f"Nondeterministic reference solution for {problem.slug} case {index}"
            )
        cases.append({"args": arguments, "expected": expected})
    public = {
        "number": problem.number,
        "slug": problem.slug,
        "title": problem.title,
        "difficulty": problem.difficulty,
        "category": problem.category,
        "topics": problem.topics,
        "summary": problem.summary,
        "constraints": problem.constraints,
        "signature": {
            "method": "solve",
            "params": [{"name": name, "type": kind} for name, kind in problem.params],
            "returnType": problem.return_type,
        },
        "starterCode": starter_code(problem),
        "caseCount": len(cases),
        "samples": cases[:3],
        "officialUrl": (
            f"https://leetcode.com/problems/{problem.slug}/"
            if problem.category == "Algorithm"
            else None
        ),
    }
    if include_cases:
        public["cases"] = cases
    return public


def main():
    if len(PROBLEMS) != 150:
        raise AssertionError(f"Expected 150 problems, got {len(PROBLEMS)}")
    difficulty_counts = Counter(problem.difficulty for problem in PROBLEMS)
    if difficulty_counts != {"Easy": 20, "Medium": 50, "Hard": 50, "Design": 30}:
        raise AssertionError(f"Unexpected difficulty mix: {difficulty_counts}")
    category_counts = Counter(problem.category for problem in PROBLEMS)
    if category_counts != {"Algorithm": 120, "Low-Level Design": 30}:
        raise AssertionError(f"Unexpected category mix: {category_counts}")
    slugs = [problem.slug for problem in PROBLEMS]
    if len(set(slugs)) != len(slugs):
        raise AssertionError("Challenge slugs must be unique")
    if any(len(problem.cases) != 20 for problem in PROBLEMS):
        raise AssertionError("Every challenge must have exactly 20 cases")

    source = {
        "source": "LeetCode algorithm metadata plus original BrainHub low-level design material",
        "neetCode150Excluded": True,
        "counts": dict(difficulty_counts),
        "categoryCounts": dict(category_counts),
    }
    frontend_payload = {
        **source,
        "problems": [serialize_problem(problem, False) for problem in PROBLEMS],
    }
    backend_payload = {
        **source,
        "problems": [serialize_problem(problem, True) for problem in PROBLEMS],
    }

    FRONTEND_CATALOG.parent.mkdir(parents=True, exist_ok=True)
    BACKEND_CATALOG.parent.mkdir(parents=True, exist_ok=True)
    FRONTEND_CATALOG.write_text(
        json.dumps(frontend_payload, indent=2) + "\n", encoding="utf-8"
    )
    BACKEND_CATALOG.write_text(
        json.dumps(backend_payload, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"Generated {len(PROBLEMS)} challenges and "
        f"{sum(len(problem.cases) for problem in PROBLEMS)} verified cases."
    )


if __name__ == "__main__":
    main()
