from __future__ import annotations

import math
import re
from bisect import bisect_left, bisect_right
from collections import Counter, OrderedDict, defaultdict, deque
from functools import cmp_to_key
from itertools import combinations
from typing import Any

MOD = 1_000_000_007
ARRAYS = (
    [],
    [0],
    [1],
    [1, 2],
    [2, 1],
    [1, 1, 2],
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
    [0, 1, 0, 3, 12],
    [1, 2, 2, 3, 3, 3],
    [9, 7, 5, 3, 1, 2, 4, 6, 8],
)


def _rotate(values: list[int], shift: int) -> list[int]:
    if not values:
        return []
    offset = shift % len(values)
    return values[offset:] + values[:offset]


def _pair_distance_case(seed: int) -> tuple[list[int], int]:
    nums = [((seed * 7 + index * 3) % 20) for index in range(2 + seed % 8)]
    pairs = len(nums) * (len(nums) - 1) // 2
    return nums, 1 + (seed * 5) % pairs


def ref_palindrome_number(value: int) -> bool:
    return value >= 0 and str(value) == str(value)[::-1]


def ref_roman_to_int(text: str) -> int:
    values = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}
    return sum(
        -values[char]
        if index + 1 < len(text) and values[char] < values[text[index + 1]]
        else values[char]
        for index, char in enumerate(text)
    )


def ref_longest_prefix(words: list[str]) -> str:
    if not words:
        return ""
    prefix = words[0]
    for word in words[1:]:
        while prefix and not word.startswith(prefix):
            prefix = prefix[:-1]
    return prefix


def ref_first_occurrence(text: str, pattern: str) -> int:
    return text.find(pattern)


def ref_last_word(text: str) -> int:
    pieces = text.split()
    return len(pieces[-1]) if pieces else 0


def ref_add_binary(first: str, second: str) -> str:
    return bin(int(first or "0", 2) + int(second or "0", 2))[2:]


def ref_sqrt(value: int) -> int:
    return math.isqrt(value)


def ref_pascal(rows: int) -> list[list[int]]:
    triangle: list[list[int]] = []
    for row in range(rows):
        triangle.append([1] * (row + 1))
        for column in range(1, row):
            triangle[row][column] = (
                triangle[row - 1][column - 1] + triangle[row - 1][column]
            )
    return triangle


def ref_majority(nums: list[int]) -> int:
    return Counter(nums).most_common(1)[0][0]


def ref_isomorphic(first: str, second: str) -> bool:
    if len(first) != len(second):
        return False
    return len(set(zip(first, second))) == len(set(first)) == len(set(second))


def ref_zigzag(text: str, rows: int) -> str:
    if rows <= 1 or rows >= len(text):
        return text
    buckets = [""] * rows
    row, direction = 0, 1
    for char in text:
        buckets[row] += char
        if row in (0, rows - 1):
            direction *= -1
        row -= direction
    return "".join(buckets)


def ref_atoi(text: str) -> int:
    match = re.match(r"\s*([+-]?\d+)", text)
    value = int(match.group(1)) if match else 0
    return max(-(2**31), min(2**31 - 1, value))


def ref_int_to_roman(value: int) -> str:
    table = (
        (1000, "M"),
        (900, "CM"),
        (500, "D"),
        (400, "CD"),
        (100, "C"),
        (90, "XC"),
        (50, "L"),
        (40, "XL"),
        (10, "X"),
        (9, "IX"),
        (5, "V"),
        (4, "IV"),
        (1, "I"),
    )
    result = []
    for amount, symbol in table:
        count, value = divmod(value, amount)
        result.append(symbol * count)
    return "".join(result)


def ref_three_sum_closest(nums: list[int], target: int) -> int:
    return min(
        (sum(group) for group in combinations(nums, 3)),
        key=lambda value: (abs(value - target), value),
    )


def ref_four_sum(nums: list[int], target: int) -> list[list[int]]:
    return [
        list(group)
        for group in sorted(
            {
                tuple(sorted(group))
                for group in combinations(nums, 4)
                if sum(group) == target
            }
        )
    ]


def ref_next_permutation(nums: list[int]) -> list[int]:
    values = nums[:]
    pivot = len(values) - 2
    while pivot >= 0 and values[pivot] >= values[pivot + 1]:
        pivot -= 1
    if pivot >= 0:
        swap = len(values) - 1
        while values[swap] <= values[pivot]:
            swap -= 1
        values[pivot], values[swap] = values[swap], values[pivot]
    values[pivot + 1 :] = reversed(values[pivot + 1 :])
    return values


def ref_search_range(nums: list[int], target: int) -> list[int]:
    left = bisect_left(nums, target)
    if left == len(nums) or nums[left] != target:
        return [-1, -1]
    return [left, bisect_right(nums, target) - 1]


def ref_count_and_say(length: int) -> str:
    value = "1"
    for _ in range(length - 1):
        pieces = []
        index = 0
        while index < len(value):
            end = index + 1
            while end < len(value) and value[end] == value[index]:
                end += 1
            pieces.append(f"{end - index}{value[index]}")
            index = end
        value = "".join(pieces)
    return value


def ref_spiral_matrix(size: int) -> list[list[int]]:
    matrix = [[0] * size for _ in range(size)]
    top, bottom, left, right, value = 0, size - 1, 0, size - 1, 1
    while top <= bottom:
        for column in range(left, right + 1):
            matrix[top][column] = value
            value += 1
        top += 1
        for row in range(top, bottom + 1):
            matrix[row][right] = value
            value += 1
        right -= 1
        if top <= bottom:
            for column in range(right, left - 1, -1):
                matrix[bottom][column] = value
                value += 1
            bottom -= 1
        if left <= right:
            for row in range(bottom, top - 1, -1):
                matrix[row][left] = value
                value += 1
            left += 1
    return matrix


def ref_unique_paths_obstacles(grid: list[list[int]]) -> int:
    if not grid or grid[0][0]:
        return 0
    dp = [0] * len(grid[0])
    dp[0] = 1
    for row in grid:
        for column, blocked in enumerate(row):
            if blocked:
                dp[column] = 0
            elif column:
                dp[column] += dp[column - 1]
    return dp[-1]


def ref_min_path_sum(grid: list[list[int]]) -> int:
    dp = [10**9] * len(grid[0])
    dp[0] = 0
    for row in grid:
        for column, value in enumerate(row):
            dp[column] = value + min(dp[column], dp[column - 1] if column else 10**9)
    return dp[-1]


def ref_combinations(length: int, choose: int) -> list[list[int]]:
    return [list(group) for group in combinations(range(1, length + 1), choose)]


def ref_remove_duplicates_two(nums: list[int]) -> list[int]:
    result: list[int] = []
    for value in nums:
        if len(result) < 2 or result[-2] != value:
            result.append(value)
    return result


def ref_rotated_search_two(nums: list[int], target: int) -> bool:
    return target in nums


def ref_gray_code(bits: int) -> list[int]:
    return [value ^ (value >> 1) for value in range(1 << bits)]


def ref_restore_ip(text: str) -> list[str]:
    result = []
    for first in range(1, 4):
        for second in range(first + 1, first + 4):
            for third in range(second + 1, second + 4):
                pieces = (
                    text[:first],
                    text[first:second],
                    text[second:third],
                    text[third:],
                )
                if all(
                    piece
                    and (piece == "0" or not piece.startswith("0"))
                    and int(piece) <= 255
                    for piece in pieces
                ):
                    result.append(".".join(pieces))
    return result


def ref_unique_bst(nodes: int) -> int:
    catalan = [1] + [0] * nodes
    for size in range(1, nodes + 1):
        catalan[size] = sum(
            catalan[left] * catalan[size - left - 1] for left in range(size)
        )
    return catalan[nodes]


def ref_triangle_path(triangle: list[list[int]]) -> int:
    dp = triangle[-1][:]
    for row in reversed(triangle[:-1]):
        dp = [value + min(dp[index], dp[index + 1]) for index, value in enumerate(row)]
    return dp[0]


def ref_stock_two(prices: list[int]) -> int:
    return sum(
        max(0, prices[index] - prices[index - 1]) for index in range(1, len(prices))
    )


def ref_single_three(nums: list[int]) -> int:
    return next(value for value, count in Counter(nums).items() if count == 1)


def ref_reverse_words(text: str) -> str:
    return " ".join(reversed(text.split()))


def ref_first_peak(nums: list[int]) -> int:
    for index, value in enumerate(nums):
        if (index == 0 or value > nums[index - 1]) and (
            index == len(nums) - 1 or value > nums[index + 1]
        ):
            return index
    return -1


def ref_maximum_gap(nums: list[int]) -> int:
    values = sorted(nums)
    return max(
        (values[index] - values[index - 1] for index in range(1, len(values))),
        default=0,
    )


def ref_trailing_zeroes(value: int) -> int:
    result = 0
    while value:
        value //= 5
        result += value
    return result


def ref_largest_number(nums: list[int]) -> str:
    def compare(first: str, second: str) -> int:
        return (second + first > first + second) - (second + first < first + second)

    result = "".join(sorted(map(str, nums), key=cmp_to_key(compare)))
    return "0" if result.startswith("0") else result


def ref_repeated_dna(text: str) -> list[str]:
    counts = Counter(text[index : index + 10] for index in range(max(0, len(text) - 9)))
    return sorted(piece for piece, count in counts.items() if count > 1)


def ref_range_and(left: int, right: int) -> int:
    shifts = 0
    while left != right:
        left >>= 1
        right >>= 1
        shifts += 1
    return left << shifts


def ref_count_primes(limit: int) -> int:
    if limit < 3:
        return 0
    prime = [True] * limit
    prime[0] = prime[1] = False
    for value in range(2, math.isqrt(limit - 1) + 1):
        if prime[value]:
            prime[value * value : limit : value] = [False] * (
                ((limit - 1 - value * value) // value) + 1
            )
    return sum(prime)


def ref_maximal_square(matrix: list[list[int]]) -> int:
    if not matrix:
        return 0
    dp = [0] * (len(matrix[0]) + 1)
    best = 0
    for row in matrix:
        diagonal = 0
        for column, value in enumerate(row, 1):
            previous = dp[column]
            dp[column] = 1 + min(dp[column], dp[column - 1], diagonal) if value else 0
            best = max(best, dp[column])
            diagonal = previous
    return best * best


def ref_rectangle_area(
    ax1: int, ay1: int, ax2: int, ay2: int, bx1: int, by1: int, bx2: int, by2: int
) -> int:
    overlap = max(0, min(ax2, bx2) - max(ax1, bx1)) * max(
        0, min(ay2, by2) - max(ay1, by1)
    )
    return (ax2 - ax1) * (ay2 - ay1) + (bx2 - bx1) * (by2 - by1) - overlap


def ref_substring_words(text: str, words: list[str]) -> list[int]:
    if not words:
        return []
    width = len(words[0])
    target = Counter(words)
    total = width * len(words)
    return [
        index
        for index in range(len(text) - total + 1)
        if Counter(
            text[position : position + width]
            for position in range(index, index + total, width)
        )
        == target
    ]


def ref_wildcard(text: str, pattern: str) -> bool:
    dp = [True] + [False] * len(text)
    for token in pattern:
        next_dp = [dp[0] and token == "*"] + [False] * len(text)
        for index, char in enumerate(text, 1):
            next_dp[index] = (
                next_dp[index - 1] or dp[index]
                if token == "*"
                else dp[index - 1] and token in ("?", char)
            )
        dp = next_dp
    return dp[-1]


def ref_n_queens(size: int) -> int:
    def visit(row: int, columns: int, rising: int, falling: int) -> int:
        if row == size:
            return 1
        available = ((1 << size) - 1) & ~(columns | rising | falling)
        total = 0
        while available:
            bit = available & -available
            available -= bit
            total += visit(
                row + 1, columns | bit, (rising | bit) << 1, (falling | bit) >> 1
            )
        return total

    return visit(0, 0, 0, 0)


def ref_permutation_sequence(length: int, position: int) -> str:
    numbers = list(range(1, length + 1))
    position -= 1
    result = []
    for remaining in range(length, 0, -1):
        block = math.factorial(remaining - 1)
        index, position = divmod(position, block)
        result.append(str(numbers.pop(index)))
    return "".join(result)


NUMBER_PATTERN = re.compile(r"^[+-]?(?:(?:\d+\.?\d*)|(?:\.\d+))(?:[eE][+-]?\d+)?$")


def ref_valid_number(text: str) -> bool:
    return bool(NUMBER_PATTERN.fullmatch(text.strip()))


def ref_palindrome_cut(text: str) -> int:
    cuts = list(range(-1, len(text)))
    for end in range(len(text)):
        for start in range(end + 1):
            piece = text[start : end + 1]
            if piece == piece[::-1]:
                cuts[end + 1] = min(cuts[end + 1], cuts[start] + 1)
    return cuts[-1]


def ref_max_points(points: list[list[int]]) -> int:
    if len(points) < 3:
        return len(points)
    best = 0
    for first in range(len(points)):
        slopes: Counter[tuple[int, int]] = Counter()
        duplicates = 1
        for second in range(first + 1, len(points)):
            dx = points[second][0] - points[first][0]
            dy = points[second][1] - points[first][1]
            if dx == dy == 0:
                duplicates += 1
                continue
            divisor = math.gcd(dx, dy)
            dx, dy = dx // divisor, dy // divisor
            if dx < 0 or (dx == 0 and dy < 0):
                dx, dy = -dx, -dy
            slopes[(dx, dy)] += 1
        best = max(best, duplicates + max(slopes.values(), default=0))
    return best


def ref_rotated_min(nums: list[int]) -> int:
    return min(nums)


def ref_skyline(buildings: list[list[int]]) -> list[list[int]]:
    xs = sorted(
        {coordinate for left, right, _ in buildings for coordinate in (left, right)}
    )
    result = []
    previous = 0
    for x in xs:
        height = max(
            (height for left, right, height in buildings if left <= x < right),
            default=0,
        )
        if height != previous:
            result.append([x, height])
            previous = height
    return result


def ref_nearby_almost(
    nums: list[int], index_distance: int, value_distance: int
) -> bool:
    return any(
        abs(nums[first] - nums[second]) <= value_distance
        for first in range(len(nums))
        for second in range(first + 1, min(len(nums), first + index_distance + 1))
    )


def ref_calculator(text: str) -> int:
    result = number = 0
    sign = 1
    stack: list[int] = []
    for char in text + "+":
        if char.isdigit():
            number = number * 10 + int(char)
        elif char in "+-":
            result += sign * number
            number = 0
            sign = 1 if char == "+" else -1
        elif char == "(":
            stack.extend((result, sign))
            result, sign = 0, 1
        elif char == ")":
            result += sign * number
            number = 0
            previous_sign = stack.pop()
            previous_result = stack.pop()
            result = previous_result + previous_sign * result
    return result


def ref_count_ones(limit: int) -> int:
    result = 0
    factor = 1
    while factor <= limit:
        lower = limit % factor
        current = (limit // factor) % 10
        higher = limit // (factor * 10)
        result += higher * factor
        if current == 1:
            result += lower + 1
        elif current > 1:
            result += factor
        factor *= 10
    return result


def ref_number_words(value: int) -> str:
    if value == 0:
        return "Zero"
    below_twenty = [
        "",
        "One",
        "Two",
        "Three",
        "Four",
        "Five",
        "Six",
        "Seven",
        "Eight",
        "Nine",
        "Ten",
        "Eleven",
        "Twelve",
        "Thirteen",
        "Fourteen",
        "Fifteen",
        "Sixteen",
        "Seventeen",
        "Eighteen",
        "Nineteen",
    ]
    tens = [
        "",
        "",
        "Twenty",
        "Thirty",
        "Forty",
        "Fifty",
        "Sixty",
        "Seventy",
        "Eighty",
        "Ninety",
    ]

    def small(number: int) -> list[str]:
        if not number:
            return []
        if number < 20:
            return [below_twenty[number]]
        if number < 100:
            return [tens[number // 10], *small(number % 10)]
        return [below_twenty[number // 100], "Hundred", *small(number % 100)]

    pieces = []
    for divisor, label in (
        (10**9, "Billion"),
        (10**6, "Million"),
        (1000, "Thousand"),
        (1, ""),
    ):
        chunk, value = divmod(value, divisor)
        if chunk:
            pieces.extend(small(chunk))
            if label:
                pieces.append(label)
    return " ".join(pieces)


def ref_remove_invalid(text: str) -> list[str]:
    level = {text}
    while True:
        valid = sorted(item for item in level if _valid_parentheses(item))
        if valid:
            return valid
        level = {
            item[:index] + item[index + 1 :]
            for item in level
            for index, char in enumerate(item)
            if char in "()"
        }


def _valid_parentheses(text: str) -> bool:
    balance = 0
    for char in text:
        if char == "(":
            balance += 1
        elif char == ")":
            balance -= 1
            if balance < 0:
                return False
    return balance == 0


def ref_range_sum(nums: list[int], lower: int, upper: int) -> int:
    prefix = [0]
    for value in nums:
        prefix.append(prefix[-1] + value)
    return sum(
        lower <= prefix[end] - prefix[start] <= upper
        for start in range(len(nums))
        for end in range(start + 1, len(nums) + 1)
    )


def ref_patching(nums: list[int], limit: int) -> int:
    missing = 1
    index = patches = 0
    while missing <= limit:
        if index < len(nums) and nums[index] <= missing:
            missing += nums[index]
            index += 1
        else:
            missing += missing
            patches += 1
    return patches


def ref_rectangle_limit(matrix: list[list[int]], limit: int) -> int:
    best = -(10**9)
    rows, columns = len(matrix), len(matrix[0])
    for top in range(rows):
        sums = [0] * columns
        for bottom in range(top, rows):
            for column in range(columns):
                sums[column] += matrix[bottom][column]
            for left in range(columns):
                total = 0
                for right in range(left, columns):
                    total += sums[right]
                    if total <= limit:
                        best = max(best, total)
    return best


def ref_frog(stones: list[int]) -> bool:
    jumps: dict[int, set[int]] = {stone: set() for stone in stones}
    jumps[0].add(0)
    for stone in stones:
        for jump in jumps[stone]:
            for next_jump in (jump - 1, jump, jump + 1):
                if next_jump > 0 and stone + next_jump in jumps:
                    jumps[stone + next_jump].add(next_jump)
    return bool(jumps[stones[-1]])


def ref_password(text: str) -> int:
    missing = sum(
        not any(check(char) for char in text)
        for check in (str.islower, str.isupper, str.isdigit)
    )
    runs = []
    index = 0
    while index < len(text):
        end = index
        while end < len(text) and text[end] == text[index]:
            end += 1
        if end - index >= 3:
            runs.append(end - index)
        index = end
    if len(text) < 6:
        return max(missing, 6 - len(text))
    if len(text) <= 20:
        return max(missing, sum(length // 3 for length in runs))
    deletions = len(text) - 20
    remaining = deletions
    replacements = sum(length // 3 for length in runs)
    modulo_zero = sum(length % 3 == 0 for length in runs)
    use = min(remaining, modulo_zero)
    replacements -= use
    remaining -= use
    modulo_one = sum(length % 3 == 1 for length in runs)
    use = min(remaining, modulo_one * 2)
    replacements -= use // 2
    remaining -= use
    replacements -= remaining // 3
    return deletions + max(missing, replacements)


def ref_arithmetic_slices(nums: list[int]) -> int:
    dp = [defaultdict(int) for _ in nums]
    result = 0
    for right in range(len(nums)):
        for left in range(right):
            difference = nums[right] - nums[left]
            result += dp[left][difference]
            dp[right][difference] += dp[left][difference] + 1
    return result


def ref_reverse_pairs(nums: list[int]) -> int:
    return sum(
        nums[first] > 2 * nums[second]
        for first in range(len(nums))
        for second in range(first + 1, len(nums))
    )


def ref_freedom_trail(ring: str, key: str) -> int:
    positions: dict[str, list[int]] = defaultdict(list)
    for index, char in enumerate(ring):
        positions[char].append(index)
    dp = {0: 0}
    for char in key:
        next_dp = {}
        for target in positions[char]:
            next_dp[target] = min(
                cost + min(abs(target - source), len(ring) - abs(target - source)) + 1
                for source, cost in dp.items()
            )
        dp = next_dp
    return min(dp.values())


def ref_attendance(length: int) -> int:
    dp = {(0, 0): 1}
    for _ in range(length):
        next_dp: dict[tuple[int, int], int] = defaultdict(int)
        for (absent, late), count in dp.items():
            next_dp[(absent, 0)] = (next_dp[(absent, 0)] + count) % MOD
            if absent == 0:
                next_dp[(1, 0)] = (next_dp[(1, 0)] + count) % MOD
            if late < 2:
                next_dp[(absent, late + 1)] = (
                    next_dp[(absent, late + 1)] + count
                ) % MOD
        dp = next_dp
    return sum(dp.values()) % MOD


def ref_no_consecutive_ones(limit: int) -> int:
    fibonacci = [1, 2]
    for _ in range(2, 32):
        fibonacci.append(fibonacci[-1] + fibonacci[-2])
    result = previous = 0
    for bit in range(30, -1, -1):
        if limit & (1 << bit):
            result += fibonacci[bit]
            if previous:
                return result
            previous = 1
        else:
            previous = 0
    return result + 1


def ref_course_schedule_three(courses: list[list[int]]) -> int:
    import heapq

    elapsed = 0
    chosen: list[int] = []
    for duration, deadline in sorted(courses, key=lambda course: course[1]):
        elapsed += duration
        heapq.heappush(chosen, -duration)
        if elapsed > deadline:
            elapsed += heapq.heappop(chosen)
    return len(chosen)


def ref_multiplication_kth(rows: int, columns: int, position: int) -> int:
    low, high = 1, rows * columns
    while low < high:
        middle = (low + high) // 2
        count = sum(min(columns, middle // row) for row in range(1, rows + 1))
        if count >= position:
            high = middle
        else:
            low = middle + 1
    return low


def ref_twenty_four(nums: list[int]) -> bool:
    def visit(values: tuple[float, ...]) -> bool:
        if len(values) == 1:
            return abs(values[0] - 24) < 1e-6
        for first in range(len(values)):
            for second in range(first + 1, len(values)):
                rest = [
                    values[index]
                    for index in range(len(values))
                    if index not in (first, second)
                ]
                a, b = values[first], values[second]
                candidates = (a + b, a - b, b - a, a * b)
                candidates += () if abs(b) < 1e-9 else (a / b,)
                candidates += () if abs(a) < 1e-9 else (b / a,)
                if any(visit((*rest, candidate)) for candidate in candidates):
                    return True
        return False

    return visit(tuple(map(float, nums)))


def ref_pair_distance(nums: list[int], position: int) -> int:
    distances = sorted(
        abs(nums[first] - nums[second])
        for first in range(len(nums))
        for second in range(first + 1, len(nums))
    )
    return distances[position - 1]


def ref_couples(row: list[int]) -> int:
    seats = row[:]
    position = {person: index for index, person in enumerate(seats)}
    swaps = 0
    for index in range(0, len(seats), 2):
        partner = seats[index] ^ 1
        if seats[index + 1] != partner:
            partner_index = position[partner]
            displaced = seats[index + 1]
            seats[index + 1], seats[partner_index] = (
                seats[partner_index],
                seats[index + 1],
            )
            position[partner], position[displaced] = index + 1, partner_index
            swaps += 1
    return swaps


def ref_min_swaps_sequences(first: list[int], second: list[int]) -> int:
    keep, swap = 0, 1
    for index in range(1, len(first)):
        next_keep = next_swap = 10**9
        if first[index] > first[index - 1] and second[index] > second[index - 1]:
            next_keep = keep
            next_swap = swap + 1
        if first[index] > second[index - 1] and second[index] > first[index - 1]:
            next_keep = min(next_keep, swap)
            next_swap = min(next_swap, keep + 1)
        keep, swap = next_keep, next_swap
    return min(keep, swap)


def _matrix(seed: int, *, binary: bool = False) -> list[list[int]]:
    if binary:
        return [
            [(seed >> (row * 4 + column)) & 1 for column in range(4)]
            for row in range(3)
        ]
    rows = 1 + seed % 4
    columns = 1 + (seed * 3) % 4
    return [
        [(seed + row * 3 + column * 5) % 9 for column in range(columns)]
        for row in range(rows)
    ]


def _triangle(seed: int) -> list[list[int]]:
    triangle = [
        [1 + (seed + row * 3 + column * 5) % 12 for column in range(row + 1)]
        for row in range(1 + seed % 6)
    ]
    triangle[0][0] += seed * 12
    return triangle


def _freedom_case(seed: int) -> tuple[str, str]:
    ring = "abcdef" + chr(103 + seed % 20)
    return ring, "".join(
        ring[(seed + index * 3) % len(ring)] for index in range(1 + seed % 5)
    )


def _minimum_swap_cases() -> tuple[tuple[list[int], list[int]], ...]:
    bases = (
        ([1, 3, 5, 4], [1, 2, 3, 7]),
        ([0, 3, 5, 8, 9], [2, 1, 4, 6, 9]),
        ([1, 3, 5], [2, 4, 6]),
        ([0, 4, 4, 10], [1, 2, 7, 11]),
    )
    cases = []
    for seed in range(20):
        first, second = bases[seed % len(bases)]
        offset = seed * 20
        cases.append(
            ([value + offset for value in first], [value + offset for value in second])
        )
    return tuple(cases)


def _algorithm_problems(Problem: Any, unique_twenty: Any) -> tuple[Any, ...]:
    twenty = lambda seeds, factory: unique_twenty(seeds, factory)
    easy = (
        Problem(
            9,
            "palindrome-number",
            "Palindrome Number",
            "Easy",
            ("Math",),
            "Decide whether a signed integer reads the same from left to right and right to left.",
            ("Negative values are not palindromes.", "Do not ignore digits."),
            (("value", "int"),),
            "boolean",
            ref_palindrome_number,
            tuple(
                (value,)
                for value in [
                    -121,
                    -1,
                    0,
                    1,
                    7,
                    10,
                    11,
                    100,
                    101,
                    121,
                    1221,
                    1231,
                    1001,
                    10001,
                    2147447412,
                    2147483647,
                    9999,
                    909,
                    90,
                    12321,
                ]
            ),
        ),
        Problem(
            13,
            "roman-to-integer",
            "Roman to Integer",
            "Easy",
            ("String", "Math"),
            "Convert a valid Roman numeral into its integer value.",
            (
                "Subtractive pairs such as IV and CM are valid.",
                "Input uses uppercase Roman symbols.",
            ),
            (("text", "String"),),
            "int",
            ref_roman_to_int,
            tuple(
                (value,)
                for value in [
                    "I",
                    "II",
                    "III",
                    "IV",
                    "V",
                    "VI",
                    "IX",
                    "X",
                    "XIV",
                    "XIX",
                    "XL",
                    "LVIII",
                    "XC",
                    "C",
                    "CD",
                    "D",
                    "CM",
                    "M",
                    "MCMXCIV",
                    "MMMCMXCIX",
                ]
            ),
        ),
        Problem(
            14,
            "longest-common-prefix",
            "Longest Common Prefix",
            "Easy",
            ("Array", "String"),
            "Return the longest prefix shared by every string in the collection.",
            (
                "Return an empty string when no prefix is shared.",
                "An empty collection has an empty prefix.",
            ),
            (("words", "String[]"),),
            "String",
            ref_longest_prefix,
            twenty(
                [(["flower", "flow", "flight"],), (["dog", "racecar", "car"],), ([],)],
                lambda i: ([f"pre{i}alpha", f"pre{i}beta", f"pre{i}"],),
            ),
        ),
        Problem(
            28,
            "find-the-index-of-the-first-occurrence-in-a-string",
            "First Substring Occurrence",
            "Easy",
            ("String", "Two Pointers"),
            "Return the first index where the pattern occurs inside the text.",
            ("Return -1 when absent.", "An empty pattern starts at index zero."),
            (("text", "String"), ("pattern", "String")),
            "int",
            ref_first_occurrence,
            twenty(
                [("sadbutsad", "sad"), ("leetcode", "leeto"), ("", "")],
                lambda i: (f"prefix-{i}-suffix-{i % 4}", str(i % 7)),
            ),
        ),
        Problem(
            58,
            "length-of-last-word",
            "Length of Last Word",
            "Easy",
            ("String",),
            "Return the character count of the final whitespace-delimited word.",
            (
                "Leading and trailing spaces do not count.",
                "The practice variant returns zero for all-whitespace input.",
            ),
            (("text", "String"),),
            "int",
            ref_last_word,
            tuple(
                (value,)
                for value in [
                    "Hello World",
                    "   fly me   to   the moon  ",
                    "luffy is still joyboy",
                    "a",
                    " ",
                    "",
                    "one two",
                    "trail ",
                    " lead",
                    "many   gaps",
                    "tab\tword",
                    "newline\nword",
                    "quant trading",
                    "C++",
                    "python libraries",
                    "real analysis",
                    "sql",
                    "architecture",
                    "last",
                    "a bb ccc",
                ]
            ),
        ),
        Problem(
            67,
            "add-binary",
            "Add Binary",
            "Easy",
            ("String", "Bit Manipulation"),
            "Add two binary strings and return the normalized binary sum.",
            (
                "Inputs contain only zero and one.",
                "The result has no unnecessary leading zeroes.",
            ),
            (("first", "String"), ("second", "String")),
            "String",
            ref_add_binary,
            twenty(
                [("0", "0"), ("11", "1"), ("1010", "1011")],
                lambda i: (bin(i + 1)[2:], bin(i * i + 3)[2:]),
            ),
        ),
        Problem(
            69,
            "sqrtx",
            "Integer Square Root",
            "Easy",
            ("Math", "Binary Search"),
            "Return the greatest integer whose square does not exceed the nonnegative input.",
            ("Discard any fractional part.", "Use integer-safe arithmetic."),
            (("value", "int"),),
            "int",
            ref_sqrt,
            tuple(
                (value,)
                for value in [
                    0,
                    1,
                    2,
                    3,
                    4,
                    8,
                    9,
                    15,
                    16,
                    24,
                    25,
                    26,
                    99,
                    100,
                    101,
                    10_000,
                    99_999_999,
                    2_147_395_599,
                    2_147_395_600,
                    2_147_483_647,
                ]
            ),
        ),
        Problem(
            118,
            "pascals-triangle",
            "Pascal's Triangle",
            "Easy",
            ("Array", "Dynamic Programming"),
            "Generate the requested number of Pascal rows, where each interior value is the sum above it.",
            ("Rows are returned from top to bottom.", "The first row contains one."),
            (("rows", "int"),),
            "int[][]",
            ref_pascal,
            tuple((value,) for value in range(1, 21)),
        ),
        Problem(
            169,
            "majority-element",
            "Majority Element",
            "Easy",
            ("Array", "Counting"),
            "Return the value appearing more than half the time.",
            ("A majority value is guaranteed.", "Values may be negative."),
            (("nums", "int[]"),),
            "int",
            ref_majority,
            twenty(
                [([3, 2, 3],), ([2, 2, 1, 1, 1, 2, 2],)],
                lambda i: ([i % 5] * (4 + i % 4) + [i + 10] * (i % 3),),
            ),
        ),
        Problem(
            205,
            "isomorphic-strings",
            "Isomorphic Strings",
            "Easy",
            ("Hash Table", "String"),
            "Check whether characters in the first string can map one-to-one onto characters in the second while preserving order.",
            (
                "A source character always maps to the same target.",
                "Two source characters cannot share one target.",
            ),
            (("first", "String"), ("second", "String")),
            "boolean",
            ref_isomorphic,
            twenty(
                [("egg", "add"), ("foo", "bar"), ("paper", "title")],
                lambda i: (f"ab{i}ab", f"xy{i % 3}xy"),
            ),
        ),
    )

    medium = (
        Problem(
            6,
            "zigzag-conversion",
            "Zigzag Conversion",
            "Medium",
            ("String", "Simulation"),
            "Write characters down and diagonally across rows, then read the rows in order.",
            (
                "One row returns the original string.",
                "Keep every character exactly once.",
            ),
            (("text", "String"), ("rows", "int")),
            "String",
            ref_zigzag,
            twenty(
                [("PAYPALISHIRING", 3), ("PAYPALISHIRING", 4), ("A", 1)],
                lambda i: (f"brainhub{i}training", 1 + i % 6),
            ),
        ),
        Problem(
            8,
            "string-to-integer-atoi",
            "String to Integer",
            "Medium",
            ("String", "Simulation"),
            "Parse optional leading whitespace and sign followed by decimal digits, clamping to signed 32-bit range.",
            (
                "Parsing stops at the first non-digit after the numeric prefix.",
                "Return zero when no numeric prefix exists.",
            ),
            (("text", "String"),),
            "int",
            ref_atoi,
            tuple(
                (value,)
                for value in [
                    "42",
                    "   -42",
                    "4193 with words",
                    "words and 987",
                    "-91283472332",
                    "+1",
                    "  +0012x",
                    "",
                    "   ",
                    "+-12",
                    "2147483647",
                    "2147483648",
                    "-2147483648",
                    "-2147483649",
                    "00000-42a1234",
                    "3.14159",
                    "  0000000000012345678",
                    "-0",
                    " +7 ",
                    "  -001",
                ]
            ),
        ),
        Problem(
            12,
            "integer-to-roman",
            "Integer to Roman",
            "Medium",
            ("Math", "String"),
            "Encode an integer using standard subtractive Roman numeral notation.",
            ("Input lies between 1 and 3999.", "Use uppercase symbols."),
            (("value", "int"),),
            "String",
            ref_int_to_roman,
            tuple(
                (value,)
                for value in [
                    1,
                    2,
                    3,
                    4,
                    5,
                    8,
                    9,
                    10,
                    14,
                    19,
                    40,
                    49,
                    58,
                    90,
                    99,
                    400,
                    944,
                    1994,
                    2026,
                    3999,
                ]
            ),
        ),
        Problem(
            16,
            "3sum-closest",
            "Three Sum Closest",
            "Medium",
            ("Array", "Two Pointers"),
            "Choose three values whose sum has minimum absolute distance from the target.",
            (
                "At least three values are provided.",
                "Ties choose the smaller sum in this practice variant.",
            ),
            (("nums", "int[]"), ("target", "int")),
            "int",
            ref_three_sum_closest,
            twenty(
                [([-1, 2, 1, -4], 1), ([0, 0, 0], 1)],
                lambda i: (
                    [((i * 3 + j * 5) % 17) - 8 for j in range(3 + i % 6)],
                    (i % 15) - 7,
                ),
            ),
        ),
        Problem(
            18,
            "4sum",
            "Four Sum",
            "Medium",
            ("Array", "Two Pointers"),
            "Return every unique sorted quadruple that adds to the target.",
            (
                "Do not repeat equivalent quadruples.",
                "Return quadruples in lexicographic order.",
            ),
            (("nums", "int[]"), ("target", "int")),
            "int[][]",
            ref_four_sum,
            twenty(
                [([1, 0, -1, 0, -2, 2], 0), ([2, 2, 2, 2, 2], 8)],
                lambda i: (
                    [((i + j * 3) % 9) - 4 for j in range(4 + i % 7)],
                    (i % 9) - 4,
                ),
            ),
        ),
        Problem(
            31,
            "next-permutation",
            "Next Permutation",
            "Medium",
            ("Array", "Two Pointers"),
            "Return the lexicographically next arrangement, wrapping to ascending order after the greatest arrangement.",
            (
                "Preserve duplicate values.",
                "Return a transformed copy for this practice version.",
            ),
            (("nums", "int[]"),),
            "int[]",
            ref_next_permutation,
            twenty(
                [([1, 2, 3],), ([3, 2, 1],), ([1, 1, 5],)],
                lambda i: ([i, *[((i * 5 + j * 3) % 7) for j in range(1 + i % 7)]],),
            ),
        ),
        Problem(
            34,
            "find-first-and-last-position-of-element-in-sorted-array",
            "First and Last Target Position",
            "Medium",
            ("Array", "Binary Search"),
            "Return the inclusive first and last indexes of a target in sorted values.",
            ("Return [-1,-1] when absent.", "The input is nondecreasing."),
            (("nums", "int[]"), ("target", "int")),
            "int[]",
            ref_search_range,
            twenty(
                [([5, 7, 7, 8, 8, 10], 8), ([5, 7, 7, 8, 8, 10], 6), ([], 0)],
                lambda i: (
                    sorted(value % 7 for value in ARRAYS[i % len(ARRAYS)]),
                    i % 7,
                ),
            ),
        ),
        Problem(
            38,
            "count-and-say",
            "Count and Say",
            "Medium",
            ("String", "Simulation"),
            "Build the nth term by describing consecutive runs in the previous decimal string.",
            ("The first term is 1.", "Read runs from left to right."),
            (("length", "int"),),
            "String",
            ref_count_and_say,
            tuple((value,) for value in range(1, 21)),
        ),
        Problem(
            59,
            "spiral-matrix-ii",
            "Spiral Matrix II",
            "Medium",
            ("Matrix", "Simulation"),
            "Fill a square matrix with consecutive integers in clockwise spiral order.",
            ("Start with one at the upper-left.", "Return an n by n matrix."),
            (("size", "int"),),
            "int[][]",
            ref_spiral_matrix,
            tuple((value,) for value in range(1, 21)),
        ),
        Problem(
            63,
            "unique-paths-ii",
            "Unique Paths With Obstacles",
            "Medium",
            ("Matrix", "Dynamic Programming"),
            "Count right-and-down paths from the upper-left to lower-right while avoiding blocked cells.",
            ("One marks a blocked cell.", "A blocked endpoint yields zero."),
            (("grid", "int[][]"),),
            "int",
            ref_unique_paths_obstacles,
            twenty(
                [([[0, 0, 0], [0, 1, 0], [0, 0, 0]],), ([[1]],)],
                lambda i: (_matrix(i, binary=True),),
            ),
        ),
        Problem(
            64,
            "minimum-path-sum",
            "Minimum Path Sum",
            "Medium",
            ("Matrix", "Dynamic Programming"),
            "Find the minimum right-and-down path sum from upper-left to lower-right.",
            ("Every visited cell contributes its value.", "Values are nonnegative."),
            (("grid", "int[][]"),),
            "int",
            ref_min_path_sum,
            twenty([([[1, 3, 1], [1, 5, 1], [4, 2, 1]],)], lambda i: (_matrix(i),)),
        ),
        Problem(
            77,
            "combinations",
            "Combinations",
            "Medium",
            ("Backtracking",),
            "Return all increasing selections of k distinct integers from 1 through n.",
            (
                "Each combination is ascending.",
                "Return combinations in lexicographic order.",
            ),
            (("length", "int"), ("choose", "int")),
            "int[][]",
            ref_combinations,
            twenty([(4, 2), (1, 1)], lambda i: (1 + i % 8, 1 + i % (1 + i % 8))),
        ),
        Problem(
            80,
            "remove-duplicates-from-sorted-array-ii",
            "Keep At Most Two Duplicates",
            "Medium",
            ("Array", "Two Pointers"),
            "Return the sorted sequence after retaining no more than two copies of each value.",
            ("Input is sorted.", "Relative order is unchanged."),
            (("nums", "int[]"),),
            "int[]",
            ref_remove_duplicates_two,
            twenty(
                [([1, 1, 1, 2, 2, 3],), ([0, 0, 1, 1, 1, 1, 2, 3, 3],)],
                lambda i: (
                    sorted(
                        value % 5 for value in ARRAYS[i % len(ARRAYS)] * (1 + i % 3)
                    ),
                ),
            ),
        ),
        Problem(
            81,
            "search-in-rotated-sorted-array-ii",
            "Search Rotated Array With Duplicates",
            "Medium",
            ("Array", "Binary Search"),
            "Determine whether the target occurs in a rotated nondecreasing array that may contain duplicates.",
            ("Return a boolean.", "The array may be empty."),
            (("nums", "int[]"), ("target", "int")),
            "boolean",
            ref_rotated_search_two,
            twenty(
                [([2, 5, 6, 0, 0, 1, 2], 0), ([2, 5, 6, 0, 0, 1, 2], 3)],
                lambda i: (
                    _rotate(sorted(value % 8 for value in ARRAYS[i % len(ARRAYS)]), i),
                    i % 8,
                ),
            ),
        ),
        Problem(
            89,
            "gray-code",
            "Gray Code",
            "Medium",
            ("Bit Manipulation", "Math"),
            "Return the canonical reflected Gray-code sequence for the requested bit width.",
            ("Begin with zero.", "Adjacent values differ by one bit."),
            (("bits", "int"),),
            "int[]",
            ref_gray_code,
            tuple((value % 11,) for value in range(20)),
        ),
        Problem(
            93,
            "restore-ip-addresses",
            "Restore IP Addresses",
            "Medium",
            ("String", "Backtracking"),
            "Insert three dots to form every valid IPv4 address represented by the digit string.",
            (
                "Each segment is 0 through 255.",
                "Leading zeroes are forbidden except for zero itself.",
            ),
            (("digits", "String"),),
            "String[]",
            ref_restore_ip,
            tuple(
                (value,)
                for value in [
                    "25525511135",
                    "0000",
                    "101023",
                    "1111",
                    "010010",
                    "123123123123",
                    "9999",
                    "256256256256",
                    "19216801",
                    "127001",
                    "1001001001",
                    "172162541",
                    "2222",
                    "1234",
                    "000256",
                    "11111111",
                    "10101010",
                    "25505011535",
                    "31415926",
                    "80808080",
                ]
            ),
        ),
        Problem(
            96,
            "unique-binary-search-trees",
            "Unique Binary Search Trees",
            "Medium",
            ("Dynamic Programming", "Math"),
            "Count structurally distinct binary search trees storing values 1 through n.",
            (
                "Only tree shape matters.",
                "The empty tree count is one in this practice variant.",
            ),
            (("nodes", "int"),),
            "int",
            ref_unique_bst,
            tuple((value % 20,) for value in range(20)),
        ),
        Problem(
            120,
            "triangle",
            "Triangle Minimum Path",
            "Medium",
            ("Array", "Dynamic Programming"),
            "Choose adjacent values down a triangle to minimize the top-to-bottom sum.",
            ("From column j move to j or j+1.", "Rows grow by one value."),
            (("triangle", "int[][]"),),
            "int",
            ref_triangle_path,
            twenty(
                [([[2], [3, 4], [6, 5, 7], [4, 1, 8, 3]],)], lambda i: (_triangle(i),)
            ),
        ),
        Problem(
            122,
            "best-time-to-buy-and-sell-stock-ii",
            "Stock Profit With Unlimited Transactions",
            "Medium",
            ("Array", "Greedy"),
            "Return maximum profit using any number of nonoverlapping buy-then-sell transactions.",
            ("Hold at most one share.", "Transactions are optional."),
            (("prices", "int[]"),),
            "int",
            ref_stock_two,
            twenty(
                [([7, 1, 5, 3, 6, 4],), ([7, 6, 4, 3, 1],)],
                lambda i: ([abs(value) + 1 for value in ARRAYS[i % len(ARRAYS)]],),
            ),
        ),
        Problem(
            137,
            "single-number-ii",
            "Single Number II",
            "Medium",
            ("Array", "Bit Manipulation"),
            "Find the value occurring once when every other value occurs exactly three times.",
            ("Values may be negative.", "One singleton is guaranteed."),
            (("nums", "int[]"),),
            "int",
            ref_single_three,
            twenty(
                [([2, 2, 3, 2],), ([0, 1, 0, 1, 0, 1, 99],)],
                lambda i: ([i + 100, *([i % 9] * 3), *([(i + 1) % 9] * 3)],),
            ),
        ),
        Problem(
            151,
            "reverse-words-in-a-string",
            "Reverse Words",
            "Medium",
            ("String", "Two Pointers"),
            "Reverse the order of whitespace-delimited words and normalize gaps to single spaces.",
            (
                "Remove leading and trailing whitespace.",
                "Do not reverse characters inside a word.",
            ),
            (("text", "String"),),
            "String",
            ref_reverse_words,
            tuple(
                (value,)
                for value in [
                    "the sky is blue",
                    "  hello world  ",
                    "a good   example",
                    "one",
                    "",
                    " ",
                    "alpha beta",
                    "1 2 3",
                    "brain hub",
                    "quant trading training",
                    "python java cpp",
                    "a  b   c",
                    "leading space",
                    " trailing",
                    "tabs\tare\tspaces",
                    "new\nline",
                    "repeat repeat",
                    "real analysis",
                    "linear algebra",
                    "last case",
                ]
            ),
        ),
        Problem(
            162,
            "find-peak-element",
            "Find First Peak",
            "Medium",
            ("Array", "Binary Search"),
            "Return the first index strictly greater than its existing neighbors.",
            (
                "Adjacent values differ.",
                "This practice variant chooses the first valid peak.",
            ),
            (("nums", "int[]"),),
            "int",
            ref_first_peak,
            twenty(
                [([1, 2, 3, 1],), ([1, 2, 1, 3, 5, 6, 4],)],
                lambda i: ([((i * 7 + j * 5) % 23) for j in range(1 + i % 9)],),
            ),
        ),
        Problem(
            164,
            "maximum-gap",
            "Maximum Sorted Gap",
            "Medium",
            ("Array", "Sorting"),
            "Return the largest difference between adjacent values after sorting.",
            ("Return zero for fewer than two values.", "Values are integers."),
            (("nums", "int[]"),),
            "int",
            ref_maximum_gap,
            twenty(
                [([3, 6, 9, 1],), ([10],)],
                lambda i: (
                    [abs(value * (i + 1)) for value in ARRAYS[i % len(ARRAYS)]],
                ),
            ),
        ),
        Problem(
            172,
            "factorial-trailing-zeroes",
            "Factorial Trailing Zeroes",
            "Medium",
            ("Math",),
            "Count trailing zeroes in n factorial without constructing the factorial.",
            (
                "Each zero is formed by a factor pair 2 and 5.",
                "The input is nonnegative.",
            ),
            (("value", "int"),),
            "int",
            ref_trailing_zeroes,
            tuple(
                (value,)
                for value in [
                    0,
                    1,
                    3,
                    5,
                    6,
                    10,
                    24,
                    25,
                    26,
                    50,
                    99,
                    100,
                    124,
                    125,
                    126,
                    625,
                    1000,
                    10_000,
                    100_000,
                    1_000_000,
                ]
            ),
        ),
        Problem(
            179,
            "largest-number",
            "Largest Concatenated Number",
            "Medium",
            ("Array", "Sorting"),
            "Arrange nonnegative integers so their decimal concatenation is as large as possible.",
            ("Return a string.", "All-zero input returns one zero."),
            (("nums", "int[]"),),
            "String",
            ref_largest_number,
            twenty(
                [([10, 2],), ([3, 30, 34, 5, 9],)],
                lambda i: (
                    [abs(value * 11 + i) for value in ARRAYS[i % len(ARRAYS)]] or [0],
                ),
            ),
        ),
        Problem(
            187,
            "repeated-dna-sequences",
            "Repeated DNA Sequences",
            "Medium",
            ("String", "Sliding Window"),
            "Return every length-ten substring appearing more than once in the DNA string.",
            ("Input uses A, C, G, and T.", "Return matches in lexicographic order."),
            (("text", "String"),),
            "String[]",
            ref_repeated_dna,
            tuple(
                (value,)
                for value in [
                    "AAAAACCCCCAAAAACCCCCCAAAAAGGGTTT",
                    "AAAAAAAAAAAAA",
                    "ACGT",
                    "ACGTACGTACGTACGT",
                    "CCCCCCCCCCC",
                    "GGGGGTTTTTGGGGGTTTTT",
                    "ACACACACACACACACACAC",
                    "TGCATGCATGCATGCA",
                    "AAAAAAAAAA",
                    "AAAAAAAAAAA",
                    "CGTACGTACGCGTACGTACG",
                    "TTTTTAAAAATTTTTAAAAA",
                    "AGCTAGCTAGCTAGCTAGCT",
                    "A",
                    "",
                    "ACGTACGTAAACGTACGTAA",
                    "CCCCCAAAAACCCCCAAAAA",
                    "GATTACAGATTACAGATTACA",
                    "TATATATATATATATATATA",
                    "ACGTTGCAACGTTGCAACGT",
                ]
            ),
        ),
        Problem(
            201,
            "bitwise-and-of-numbers-range",
            "Range Bitwise AND",
            "Medium",
            ("Bit Manipulation",),
            "Return the bitwise AND of every integer in the inclusive range.",
            (
                "Both bounds are nonnegative.",
                "The left bound does not exceed the right.",
            ),
            (("left", "int"), ("right", "int")),
            "int",
            ref_range_and,
            twenty([(5, 7), (0, 0), (1, 2)], lambda i: (i * i, i * i + i % 12)),
        ),
        Problem(
            204,
            "count-primes",
            "Count Primes",
            "Medium",
            ("Math", "Sieve"),
            "Count prime numbers strictly smaller than the limit.",
            ("Zero and one are not prime.", "The upper bound is excluded."),
            (("limit", "int"),),
            "int",
            ref_count_primes,
            tuple(
                (value,)
                for value in [
                    0,
                    1,
                    2,
                    3,
                    4,
                    5,
                    10,
                    20,
                    50,
                    100,
                    101,
                    250,
                    500,
                    999,
                    1000,
                    2048,
                    4096,
                    5000,
                    7500,
                    10_000,
                ]
            ),
        ),
        Problem(
            221,
            "maximal-square",
            "Maximal Square",
            "Medium",
            ("Matrix", "Dynamic Programming"),
            "Return the area of the largest all-one square in a binary matrix.",
            ("Return area rather than side length.", "An empty matrix returns zero."),
            (("matrix", "int[][]"),),
            "int",
            ref_maximal_square,
            twenty(
                [([],), ([[1]],), ([[1, 0], [1, 1]],)],
                lambda i: (_matrix(i, binary=True),),
            ),
        ),
        Problem(
            223,
            "rectangle-area",
            "Combined Rectangle Area",
            "Medium",
            ("Math", "Geometry"),
            "Return the union area of two axis-aligned rectangles.",
            (
                "Each rectangle has positive width and height.",
                "Subtract overlap exactly once.",
            ),
            (
                ("ax1", "int"),
                ("ay1", "int"),
                ("ax2", "int"),
                ("ay2", "int"),
                ("bx1", "int"),
                ("by1", "int"),
                ("bx2", "int"),
                ("by2", "int"),
            ),
            "int",
            ref_rectangle_area,
            twenty(
                [(-3, 0, 3, 4, 0, -1, 9, 2)],
                lambda i: (
                    i % 5,
                    i % 7,
                    i % 5 + 1 + i % 4,
                    i % 7 + 2 + i % 3,
                    (i * 2) % 8,
                    (i * 3) % 6,
                    (i * 2) % 8 + 1 + (i + 1) % 5,
                    (i * 3) % 6 + 1 + (i + 2) % 4,
                ),
            ),
        ),
    )

    hard = _hard_problems(Problem, unique_twenty)
    return (*easy, *medium, *hard)


def _hard_problems(Problem: Any, unique_twenty: Any) -> tuple[Any, ...]:
    twenty = lambda seeds, factory: unique_twenty(seeds, factory)
    binary_words = ["foo", "bar", "the", "word", "good", "best", "code", "brain", "hub"]
    return (
        Problem(
            30,
            "substring-with-concatenation-of-all-words",
            "Concatenated Word Starts",
            "Hard",
            ("String", "Sliding Window"),
            "Return every index where a substring is a concatenation of all equal-width words in any order.",
            (
                "Use every supplied word exactly once.",
                "Return indexes in ascending order.",
            ),
            (("text", "String"), ("words", "String[]")),
            "int[]",
            ref_substring_words,
            twenty(
                [
                    ("barfoothefoobarman", ["foo", "bar"]),
                    ("wordgoodgoodgoodbestword", ["word", "good", "best", "word"]),
                ],
                lambda i: (
                    "".join(
                        binary_words[(i + j * 3) % len(binary_words)]
                        for j in range(8 + i % 5)
                    ),
                    [
                        binary_words[i % len(binary_words)],
                        binary_words[(i + 3) % len(binary_words)],
                    ],
                ),
            ),
        ),
        Problem(
            44,
            "wildcard-matching",
            "Wildcard Matching",
            "Hard",
            ("String", "Dynamic Programming"),
            "Match the entire text against a pattern where question mark matches one character and star matches any sequence.",
            ("The complete text must match.", "Star may match an empty sequence."),
            (("text", "String"), ("pattern", "String")),
            "boolean",
            ref_wildcard,
            tuple(
                (first, second)
                for first, second in [
                    ("aa", "a"),
                    ("aa", "*"),
                    ("cb", "?a"),
                    ("adceb", "*a*b"),
                    ("acdcb", "a*c?b"),
                    ("", ""),
                    ("", "*"),
                    ("abc", "???"),
                    ("abc", "a**c"),
                    ("mississippi", "m??*ss*?i*pi"),
                    ("brainhub", "b*hub"),
                    ("quant", "q?an*"),
                    ("abcdef", "a*d*f"),
                    ("abcdef", "a*e"),
                    ("x", "?"),
                    ("xyz", "*?*?*"),
                    ("aaaa", "a*a"),
                    ("ab", "**"),
                    ("programming", "p*g"),
                    ("leetcode", "*code"),
                ]
            ),
        ),
        Problem(
            52,
            "n-queens-ii",
            "N-Queens Count",
            "Hard",
            ("Backtracking", "Bit Manipulation"),
            "Count placements of n queens where no two share a row, column, or diagonal.",
            (
                "One queen is placed in every row.",
                "Rotations and reflections count separately.",
            ),
            (("size", "int"),),
            "int",
            ref_n_queens,
            tuple((1 + value % 10,) for value in range(20)),
        ),
        Problem(
            60,
            "permutation-sequence",
            "K-th Permutation Sequence",
            "Hard",
            ("Math", "Combinatorics"),
            "Return the one-indexed kth lexicographic permutation of the digits 1 through n.",
            ("The requested position is valid.", "Each digit appears once."),
            (("length", "int"), ("position", "int")),
            "String",
            ref_permutation_sequence,
            twenty(
                [(3, 3), (4, 9)],
                lambda i: (1 + i % 8, 1 + (i * 97) % math.factorial(1 + i % 8)),
            ),
        ),
        Problem(
            65,
            "valid-number",
            "Valid Number",
            "Hard",
            ("String", "Finite State Machine"),
            "Decide whether the entire trimmed string is a valid decimal number with an optional exponent.",
            (
                "An exponent must contain an integer.",
                "At least one mantissa digit is required.",
            ),
            (("text", "String"),),
            "boolean",
            ref_valid_number,
            tuple(
                (value,)
                for value in [
                    "2",
                    "0089",
                    "-0.1",
                    "+3.14",
                    "4.",
                    "-.9",
                    "2e10",
                    "-90E3",
                    "3e+7",
                    "+6e-1",
                    "53.5e93",
                    "-123.456e789",
                    "abc",
                    "1a",
                    "1e",
                    "e3",
                    "99e2.5",
                    "--6",
                    "-+3",
                    "95a54e53",
                ]
            ),
        ),
        Problem(
            132,
            "palindrome-partitioning-ii",
            "Minimum Palindrome Cuts",
            "Hard",
            ("String", "Dynamic Programming"),
            "Return the fewest cuts needed to partition the string into palindromic pieces.",
            ("A palindrome needs no cut.", "The empty string needs zero cuts."),
            (("text", "String"),),
            "int",
            ref_palindrome_cut,
            tuple(
                (value,)
                for value in [
                    "aab",
                    "a",
                    "ab",
                    "",
                    "abba",
                    "banana",
                    "racecar",
                    "abcde",
                    "aaaa",
                    "abab",
                    "cdd",
                    "noonabbad",
                    "mississippi",
                    "levelup",
                    "civic",
                    "leetcode",
                    "cabacaba",
                    "xyzzyx",
                    "abcbaefgfe",
                    "quant",
                ]
            ),
        ),
        Problem(
            149,
            "max-points-on-a-line",
            "Maximum Collinear Points",
            "Hard",
            ("Array", "Math", "Geometry"),
            "Return the greatest number of points lying on one infinite straight line.",
            ("Duplicate coordinates are counted.", "Vertical lines are valid."),
            (("points", "int[][]"),),
            "int",
            ref_max_points,
            twenty(
                [
                    ([[1, 1], [2, 2], [3, 3]],),
                    ([[1, 1], [3, 2], [5, 3], [4, 1], [2, 3], [1, 4]],),
                ],
                lambda i: ([[j, (j * (i % 4 + 1) + i) % 9] for j in range(1 + i % 8)],),
            ),
        ),
        Problem(
            154,
            "find-minimum-in-rotated-sorted-array-ii",
            "Minimum in Rotated Array II",
            "Hard",
            ("Array", "Binary Search"),
            "Return the minimum value in a rotated sorted array that may contain duplicates.",
            (
                "At least one value is present.",
                "The original ordering was nondecreasing.",
            ),
            (("nums", "int[]"),),
            "int",
            ref_rotated_min,
            twenty(
                [([1, 3, 5],), ([2, 2, 2, 0, 1],)],
                lambda i: (
                    _rotate(
                        sorted(value % 8 for value in (ARRAYS[i % len(ARRAYS)] or [i])),
                        i,
                    ),
                ),
            ),
        ),
        Problem(
            218,
            "the-skyline-problem",
            "Building Skyline",
            "Hard",
            ("Heap", "Sweep Line"),
            "Return critical x-coordinates where the maximum active building height changes.",
            (
                "Buildings are [left,right,height].",
                "Do not emit consecutive points with equal height.",
            ),
            (("buildings", "int[][]"),),
            "int[][]",
            ref_skyline,
            twenty(
                [([[2, 9, 10], [3, 7, 15], [5, 12, 12], [15, 20, 10], [19, 24, 8]],)],
                lambda i: (
                    [
                        [j * 2, j * 2 + 2 + (i + j) % 4, 1 + (i * 3 + j * 5) % 15]
                        for j in range(1 + i % 6)
                    ],
                ),
            ),
        ),
        Problem(
            220,
            "contains-duplicate-iii",
            "Nearby Almost Duplicate",
            "Hard",
            ("Array", "Ordered Set"),
            "Determine whether two positions are close enough in both index and value.",
            (
                "Index distance and value distance are inclusive.",
                "The positions must differ.",
            ),
            (("nums", "int[]"), ("indexDistance", "int"), ("valueDistance", "int")),
            "boolean",
            ref_nearby_almost,
            twenty(
                [([1, 2, 3, 1], 3, 0), ([1, 5, 9, 1, 5, 9], 2, 3)],
                lambda i: (ARRAYS[i % len(ARRAYS)], 1 + i % 6, i % 5),
            ),
        ),
        Problem(
            224,
            "basic-calculator",
            "Basic Calculator",
            "Hard",
            ("String", "Stack"),
            "Evaluate an integer expression containing addition, subtraction, parentheses, and whitespace.",
            ("Unary signs are allowed.", "Division and multiplication are absent."),
            (("expression", "String"),),
            "int",
            ref_calculator,
            tuple(
                (value,)
                for value in [
                    "1 + 1",
                    " 2-1 + 2 ",
                    "(1+(4+5+2)-3)+(6+8)",
                    "-2+1",
                    "1-(     -2)",
                    "0",
                    "10-(2+3)",
                    "((7))",
                    "5-(3-(2-1))",
                    "100 + (20 - 5)",
                    "-10",
                    "+8",
                    "1-(-1)",
                    "2-(5-6)",
                    "12 + 34 - 5",
                    "(9-3)+(2-8)",
                    "1-(2-(3-(4)))",
                    "999",
                    "7 + (8 - (9 - 10))",
                    "42-(40+2)",
                ]
            ),
        ),
        Problem(
            233,
            "number-of-digit-one",
            "Count Digit One",
            "Hard",
            ("Math", "Dynamic Programming"),
            "Count how many digit ones appear across all nonnegative integers up to n.",
            ("Include both endpoints.", "Leading zeroes are not written."),
            (("limit", "int"),),
            "int",
            ref_count_ones,
            tuple(
                (value,)
                for value in [
                    0,
                    1,
                    2,
                    9,
                    10,
                    11,
                    12,
                    13,
                    19,
                    20,
                    21,
                    99,
                    100,
                    101,
                    110,
                    111,
                    999,
                    1000,
                    12_345,
                    1_000_000,
                ]
            ),
        ),
        Problem(
            273,
            "integer-to-english-words",
            "Integer to English Words",
            "Hard",
            ("Math", "String"),
            "Write a nonnegative integer in canonical American English words.",
            (
                "Use Billion, Million, Thousand, and Hundred groups.",
                "Do not use the word and.",
            ),
            (("value", "int"),),
            "String",
            ref_number_words,
            tuple(
                (value,)
                for value in [
                    0,
                    1,
                    9,
                    10,
                    11,
                    19,
                    20,
                    21,
                    99,
                    100,
                    101,
                    110,
                    123,
                    1000,
                    1001,
                    12_345,
                    1_000_000,
                    1_000_001,
                    1_234_567,
                    2_147_483_647,
                ]
            ),
        ),
        Problem(
            301,
            "remove-invalid-parentheses",
            "Remove Invalid Parentheses",
            "Hard",
            ("String", "Breadth-First Search"),
            "Remove the fewest parentheses needed to produce every valid result.",
            (
                "Keep non-parenthesis characters.",
                "Return unique results in lexicographic order.",
            ),
            (("text", "String"),),
            "String[]",
            ref_remove_invalid,
            tuple(
                (value,)
                for value in [
                    "()())()",
                    "(a)())()",
                    ")(",
                    "",
                    "()",
                    "((",
                    "))",
                    "(()",
                    "())",
                    "a(b)c",
                    "(((abc)",
                    "(()))(()",
                    "a)b(c)d",
                    "((x))",
                    "())(()",
                    "(()(()",
                    "no parens",
                    "))((",
                    "(q))((r)",
                    "((())",
                ]
            ),
        ),
        Problem(
            327,
            "count-of-range-sum",
            "Count Range Sums",
            "Hard",
            ("Array", "Prefix Sum", "Merge Sort"),
            "Count contiguous ranges whose sum lies inside the inclusive lower and upper bounds.",
            (
                "Values and bounds may be negative.",
                "Count each index range separately.",
            ),
            (("nums", "int[]"), ("lower", "int"), ("upper", "int")),
            "int",
            ref_range_sum,
            twenty(
                [([-2, 5, -1], -2, 2), ([0], 0, 0)],
                lambda i: (ARRAYS[i % len(ARRAYS)], -(i % 6), i % 8),
            ),
        ),
        Problem(
            330,
            "patching-array",
            "Patching Array",
            "Hard",
            ("Array", "Greedy"),
            "Add the fewest positive values so every sum from one through n can be formed from a subset.",
            ("Input values are positive and sorted.", "Each value may be used once."),
            (("nums", "int[]"), ("limit", "int")),
            "int",
            ref_patching,
            twenty(
                [([1, 3], 6), ([1, 5, 10], 20), ([1, 2, 2], 5)],
                lambda i: (
                    sorted({abs(value) + 1 for value in ARRAYS[i % len(ARRAYS)]}),
                    1 + i * 7,
                ),
            ),
        ),
        Problem(
            363,
            "max-sum-of-rectangle-no-larger-than-k",
            "Max Rectangle Sum At Most K",
            "Hard",
            ("Matrix", "Prefix Sum"),
            "Return the greatest rectangular submatrix sum that does not exceed k.",
            (
                "At least one valid rectangle exists.",
                "Rectangles are axis-aligned and nonempty.",
            ),
            (("matrix", "int[][]"), ("limit", "int")),
            "int",
            ref_rectangle_limit,
            twenty(
                [([[1, 0, 1], [0, -2, 3]], 2)],
                lambda i: (
                    [
                        [
                            ((i + row * 5 + column * 3) % 9) - 4
                            for column in range(1 + (i * 3) % 4)
                        ]
                        for row in range(1 + i % 4)
                    ],
                    3 + i % 8,
                ),
            ),
        ),
        Problem(
            403,
            "frog-jump",
            "Frog Jump",
            "Hard",
            ("Array", "Dynamic Programming"),
            "Determine whether jumps of k-1, k, or k+1 can reach the last stone after a jump of k.",
            ("The first jump must be one.", "Stone positions are strictly increasing."),
            (("stones", "int[]"),),
            "boolean",
            ref_frog,
            twenty(
                [([0, 1, 3, 5, 6, 8, 12, 17],), ([0, 1, 2, 3, 4, 8, 9, 11],)],
                lambda i: (
                    [
                        0,
                        *[
                            sum(1 + (i + step) % 3 for step in range(index))
                            for index in range(1, 3 + i % 8)
                        ],
                    ],
                ),
            ),
        ),
        Problem(
            420,
            "strong-password-checker",
            "Strong Password Checker",
            "Hard",
            ("String", "Greedy"),
            "Return the fewest insertions, deletions, or replacements needed for a strong password.",
            (
                "Strong length is 6 through 20.",
                "Require lowercase, uppercase, digit, and no run of three identical characters.",
            ),
            (("password", "String"),),
            "int",
            ref_password,
            tuple(
                (value,)
                for value in [
                    "a",
                    "aA1",
                    "1337C0d3",
                    "aaa111",
                    "ABABABABABABABABABAB1",
                    "bbaaaaaaaaaaaaaaacccccc",
                    "",
                    "123456",
                    "abcdef",
                    "ABCDEF",
                    "aA1aaa",
                    "aaaB1",
                    "aA12345678901234567890",
                    "........",
                    "Password1",
                    "passWORD",
                    "1111111111",
                    "Aa0Aa0",
                    "aaaaaaaaaaaaaaaaaaaaa",
                    "A1b2C3d4E5f6G7h8I9j0K",
                ]
            ),
        ),
        Problem(
            446,
            "arithmetic-slices-ii-subsequence",
            "Arithmetic Subsequences",
            "Hard",
            ("Array", "Dynamic Programming"),
            "Count arithmetic subsequences containing at least three values.",
            ("Keep original index order.", "Subsequences need not be contiguous."),
            (("nums", "int[]"),),
            "int",
            ref_arithmetic_slices,
            twenty(
                [([2, 4, 6, 8, 10],), ([7, 7, 7, 7, 7],)],
                lambda i: (
                    [((i * 3 + j * (1 + i % 4)) % 17) for j in range(3 + i % 7)],
                ),
            ),
        ),
        Problem(
            493,
            "reverse-pairs",
            "Reverse Pairs",
            "Hard",
            ("Array", "Merge Sort"),
            "Count index pairs i before j where the earlier value is greater than twice the later value.",
            ("Use strict greater-than.", "Values may be negative."),
            (("nums", "int[]"),),
            "int",
            ref_reverse_pairs,
            twenty(
                [([1, 3, 2, 3, 1],), ([2, 4, 3, 5, 1],)],
                lambda i: (ARRAYS[i % len(ARRAYS)],),
            ),
        ),
        Problem(
            514,
            "freedom-trail",
            "Freedom Trail",
            "Hard",
            ("String", "Dynamic Programming"),
            "Rotate a circular character ring in either direction and press to spell the key with minimum steps.",
            (
                "One press is required per key character.",
                "Every key character occurs on the ring.",
            ),
            (("ring", "String"), ("key", "String")),
            "int",
            ref_freedom_trail,
            twenty([("godding", "gd")], _freedom_case),
        ),
        Problem(
            552,
            "student-attendance-record-ii",
            "Student Attendance Record II",
            "Hard",
            ("Dynamic Programming",),
            "Count length-n records with fewer than two absences and no three consecutive late days.",
            ("Use modulo 1,000,000,007.", "Each day is present, absent, or late."),
            (("length", "int"),),
            "int",
            ref_attendance,
            tuple((value,) for value in range(1, 21)),
        ),
        Problem(
            600,
            "non-negative-integers-without-consecutive-ones",
            "Integers Without Consecutive Ones",
            "Hard",
            ("Bit Manipulation", "Dynamic Programming"),
            "Count integers from zero through n whose binary form has no adjacent one bits.",
            ("Include zero and n when valid.", "Leading zeroes are irrelevant."),
            (("limit", "int"),),
            "int",
            ref_no_consecutive_ones,
            tuple(
                (value,)
                for value in [
                    0,
                    1,
                    2,
                    3,
                    4,
                    5,
                    8,
                    10,
                    16,
                    21,
                    31,
                    32,
                    64,
                    100,
                    255,
                    256,
                    1000,
                    10_000,
                    1_000_000,
                    1_000_000_000,
                ]
            ),
        ),
        Problem(
            630,
            "course-schedule-iii",
            "Course Schedule III",
            "Hard",
            ("Array", "Greedy", "Heap"),
            "Choose the maximum number of courses, each requiring consecutive duration before its deadline.",
            ("Only one course runs at a time.", "Courses may be reordered."),
            (("courses", "int[][]"),),
            "int",
            ref_course_schedule_three,
            twenty(
                [([[100, 200], [200, 1300], [1000, 1250], [2000, 3200]],)],
                lambda i: (
                    [
                        [1 + (i * 3 + j * 5) % 20, 5 + (i * 7 + j * 11) % 80]
                        for j in range(1 + i % 8)
                    ],
                ),
            ),
        ),
        Problem(
            668,
            "kth-smallest-number-in-multiplication-table",
            "K-th Multiplication Table Value",
            "Hard",
            ("Binary Search", "Math"),
            "Return the kth smallest entry in an m by n multiplication table.",
            (
                "Rows and columns are one-indexed factors.",
                "Duplicate products occupy separate positions.",
            ),
            (("rows", "int"), ("columns", "int"), ("position", "int")),
            "int",
            ref_multiplication_kth,
            twenty(
                [(3, 3, 5), (2, 3, 6)],
                lambda i: (
                    1 + i % 12,
                    1 + (i * 3) % 12,
                    1 + (i * 7) % ((1 + i % 12) * (1 + (i * 3) % 12)),
                ),
            ),
        ),
        Problem(
            679,
            "24-game",
            "Twenty Four Game",
            "Hard",
            ("Array", "Backtracking"),
            "Determine whether four values can make 24 using binary arithmetic operations and parentheses.",
            ("Use each value exactly once.", "Division is real-valued."),
            (("cards", "int[]"),),
            "boolean",
            ref_twenty_four,
            tuple(
                ([1 + (value // (9**offset)) % 9 for offset in range(4)],)
                for value in range(20)
            ),
        ),
        Problem(
            719,
            "find-k-th-smallest-pair-distance",
            "K-th Pair Distance",
            "Hard",
            ("Array", "Binary Search"),
            "Sort all absolute distances between index pairs and return the kth smallest.",
            ("Positions must differ.", "Duplicate distances count separately."),
            (("nums", "int[]"), ("position", "int")),
            "int",
            ref_pair_distance,
            twenty(
                [([1, 3, 1], 1), ([1, 1, 1], 2)],
                _pair_distance_case,
            ),
        ),
        Problem(
            765,
            "couples-holding-hands",
            "Couples Holding Hands",
            "Hard",
            ("Array", "Greedy"),
            "Return the minimum swaps needed so every adjacent seat pair contains partners numbered x and x xor one.",
            ("Each person appears once.", "Swap any two seated people."),
            (("row", "int[]"),),
            "int",
            ref_couples,
            twenty(
                [([0, 2, 1, 3],), ([3, 2, 0, 1],)],
                lambda i: (_rotate(list(range(2 * (1 + i % 7))), i * 3),),
            ),
        ),
        Problem(
            801,
            "minimum-swaps-to-make-sequences-increasing",
            "Minimum Swaps for Increasing Sequences",
            "Hard",
            ("Array", "Dynamic Programming"),
            "Swap values at matching indexes in two arrays so both become strictly increasing, minimizing swaps.",
            (
                "A valid result is guaranteed.",
                "A swap exchanges values only at one shared index.",
            ),
            (("first", "int[]"), ("second", "int[]")),
            "int",
            ref_min_swaps_sequences,
            _minimum_swap_cases(),
        ),
    )


def simulate_design(
    kind: str, operations: list[str], arguments: list[list[int]]
) -> list[int]:
    if kind == "lru-cache":
        cache: OrderedDict[int, int] = OrderedDict()
        capacity = 1
        result = []
        for operation, values in zip(operations, arguments, strict=True):
            if operation == "init":
                capacity = values[0]
                cache.clear()
                result.append(-1)
            elif operation == "put":
                key, value = values
                cache.pop(key, None)
                cache[key] = value
                if len(cache) > capacity:
                    cache.popitem(last=False)
                result.append(-1)
            else:
                key = values[0]
                if key not in cache:
                    result.append(-1)
                else:
                    value = cache.pop(key)
                    cache[key] = value
                    result.append(value)
        return result

    if kind == "lfu-cache":
        capacity = 1
        values: dict[int, int] = {}
        frequency: Counter[int] = Counter()
        touched: dict[int, int] = {}
        clock = 0
        result = []
        for operation, args in zip(operations, arguments, strict=True):
            clock += 1
            if operation == "init":
                capacity = args[0]
                values.clear()
                frequency.clear()
                touched.clear()
                result.append(-1)
            elif operation == "get":
                key = args[0]
                if key not in values:
                    result.append(-1)
                else:
                    frequency[key] += 1
                    touched[key] = clock
                    result.append(values[key])
            else:
                key, value = args
                if capacity == 0:
                    result.append(-1)
                    continue
                if key not in values and len(values) == capacity:
                    victim = min(
                        values, key=lambda item: (frequency[item], touched[item])
                    )
                    del values[victim], frequency[victim], touched[victim]
                values[key] = value
                frequency[key] += 1
                touched[key] = clock
                result.append(-1)
        return result

    if kind == "ttl-cache":
        cache: dict[int, tuple[int, int]] = {}
        result = []
        for operation, args in zip(operations, arguments, strict=True):
            if operation == "put":
                key, value, expires = args
                cache[key] = (value, expires)
                result.append(-1)
            elif operation == "get":
                key, now = args
                value = cache.get(key)
                result.append(value[0] if value and now < value[1] else -1)
            else:
                now = args[0]
                expired = [key for key, (_, expires) in cache.items() if now >= expires]
                for key in expired:
                    del cache[key]
                result.append(len(expired))
        return result

    if kind in {"fixed-window-rate-limiter", "sliding-window-rate-limiter"}:
        result = []
        fixed: Counter[tuple[int, int]] = Counter()
        sliding: dict[int, deque[int]] = defaultdict(deque)
        for operation, args in zip(operations, arguments, strict=True):
            user, timestamp, limit, window = args
            if kind.startswith("fixed"):
                key = (user, timestamp // window)
                allowed = fixed[key] < limit
                if allowed:
                    fixed[key] += 1
            else:
                queue = sliding[user]
                while queue and queue[0] <= timestamp - window:
                    queue.popleft()
                allowed = len(queue) < limit
                if allowed:
                    queue.append(timestamp)
            result.append(int(allowed))
        return result

    if kind in {"token-bucket", "leaky-bucket"}:
        state: dict[int, tuple[int, int]] = {}
        result = []
        for operation, args in zip(operations, arguments, strict=True):
            user, timestamp, capacity, rate = args
            level, last = state.get(
                user, ((capacity if kind == "token-bucket" else 0), timestamp)
            )
            elapsed = max(0, timestamp - last)
            if kind == "token-bucket":
                level = min(capacity, level + elapsed * rate)
                accepted = level > 0
                level -= int(accepted)
            else:
                level = max(0, level - elapsed * rate)
                accepted = level < capacity
                level += int(accepted)
            state[user] = (level, timestamp)
            result.append(int(accepted))
        return result

    if kind == "hit-counter":
        hits: deque[int] = deque()
        result = []
        for operation, args in zip(operations, arguments, strict=True):
            timestamp = args[0]
            if operation == "hit":
                hits.append(timestamp)
                result.append(-1)
            else:
                while hits and hits[0] <= timestamp - 300:
                    hits.popleft()
                result.append(len(hits))
        return result

    if kind == "moving-average":
        size = 1
        values: deque[int] = deque()
        result = []
        for operation, args in zip(operations, arguments, strict=True):
            if operation == "init":
                size = args[0]
                values.clear()
                result.append(-1)
            else:
                values.append(args[0])
                if len(values) > size:
                    values.popleft()
                result.append(sum(values) // len(values))
        return result

    if kind == "median-finder":
        values: list[int] = []
        result = []
        for operation, args in zip(operations, arguments, strict=True):
            if operation == "add":
                values.insert(bisect_left(values, args[0]), args[0])
                result.append(-1)
            else:
                result.append(values[(len(values) - 1) // 2])
        return result

    if kind in {"min-stack", "max-stack", "queue-two-stacks", "stack-two-queues"}:
        values: list[int] = []
        result = []
        for operation, args in zip(operations, arguments, strict=True):
            if operation == "push":
                values.append(args[0])
                result.append(-1)
            elif operation in {"pop", "dequeue"}:
                result.append(
                    values.pop(0 if kind == "queue-two-stacks" else -1)
                    if values
                    else -1
                )
            elif operation in {"top", "peek"}:
                result.append(
                    values[0 if kind == "queue-two-stacks" else -1] if values else -1
                )
            elif operation == "min":
                result.append(min(values) if values else -1)
            elif operation == "peekMax":
                result.append(max(values) if values else -1)
            elif operation == "popMax":
                maximum = max(values)
                reverse_index = values[::-1].index(maximum)
                result.append(values.pop(len(values) - reverse_index - 1))
            else:
                result.append(int(not values))
        return result

    if kind in {"circular-queue", "circular-deque"}:
        capacity = 1
        values: deque[int] = deque()
        result = []
        for operation, args in zip(operations, arguments, strict=True):
            if operation == "init":
                capacity = args[0]
                values.clear()
                result.append(-1)
            elif operation in {"enQueue", "insertLast"}:
                accepted = len(values) < capacity
                if accepted:
                    values.append(args[0])
                result.append(int(accepted))
            elif operation == "insertFront":
                accepted = len(values) < capacity
                if accepted:
                    values.appendleft(args[0])
                result.append(int(accepted))
            elif operation in {"deQueue", "deleteFront"}:
                accepted = bool(values)
                if accepted:
                    values.popleft()
                result.append(int(accepted))
            elif operation == "deleteLast":
                accepted = bool(values)
                if accepted:
                    values.pop()
                result.append(int(accepted))
            elif operation in {"Front", "getFront"}:
                result.append(values[0] if values else -1)
            elif operation in {"Rear", "getRear"}:
                result.append(values[-1] if values else -1)
            elif operation == "isEmpty":
                result.append(int(not values))
            else:
                result.append(int(len(values) == capacity))
        return result

    if kind == "browser-history":
        history = [0]
        position = 0
        result = []
        for operation, args in zip(operations, arguments, strict=True):
            if operation == "init":
                history, position = [args[0]], 0
                result.append(-1)
            elif operation == "visit":
                history = history[: position + 1]
                history.append(args[0])
                position += 1
                result.append(-1)
            elif operation == "back":
                position = max(0, position - args[0])
                result.append(history[position])
            else:
                position = min(len(history) - 1, position + args[0])
                result.append(history[position])
        return result

    if kind == "parking-lot":
        capacity = [0, 0, 0]
        occupied = [0, 0, 0]
        result = []
        for operation, args in zip(operations, arguments, strict=True):
            if operation == "init":
                capacity = args[:3]
                occupied = [0, 0, 0]
                result.append(-1)
            elif operation == "park":
                spot = args[0]
                accepted = occupied[spot] < capacity[spot]
                occupied[spot] += int(accepted)
                result.append(int(accepted))
            elif operation == "leave":
                spot = args[0]
                accepted = occupied[spot] > 0
                occupied[spot] -= int(accepted)
                result.append(int(accepted))
            else:
                result.append(capacity[args[0]] - occupied[args[0]])
        return result

    if kind == "elevator-controller":
        floor = 0
        pending: set[int] = set()
        result = []
        for operation, args in zip(operations, arguments, strict=True):
            if operation == "init":
                floor = args[0]
                pending.clear()
                result.append(-1)
            elif operation == "request":
                pending.add(args[0])
                result.append(-1)
            elif operation == "step":
                if pending:
                    target = min(pending, key=lambda item: (abs(item - floor), item))
                    floor += (target > floor) - (target < floor)
                    if floor == target:
                        pending.remove(target)
                result.append(floor)
            else:
                result.append(floor)
        return result

    if kind == "vending-machine":
        stock: dict[int, tuple[int, int]] = {}
        balance = 0
        result = []
        for operation, args in zip(operations, arguments, strict=True):
            if operation == "stock":
                item, count, price = args
                current = stock.get(item, (0, price))[0]
                stock[item] = (current + count, price)
                result.append(-1)
            elif operation == "insert":
                balance += args[0]
                result.append(balance)
            elif operation == "buy":
                item = args[0]
                count, price = stock.get(item, (0, 10**9))
                accepted = count > 0 and balance >= price
                if accepted:
                    stock[item] = (count - 1, price)
                    balance -= price
                result.append(int(accepted))
            else:
                result.append(balance)
                balance = 0
        return result

    if kind == "library-catalog":
        copies: Counter[int] = Counter()
        result = []
        for operation, args in zip(operations, arguments, strict=True):
            book = args[0]
            if operation == "add":
                copies[book] += args[1]
                result.append(-1)
            elif operation == "borrow":
                accepted = copies[book] > 0
                copies[book] -= int(accepted)
                result.append(int(accepted))
            elif operation == "return":
                copies[book] += 1
                result.append(-1)
            else:
                result.append(copies[book])
        return result

    if kind == "priority-task-scheduler":
        tasks: dict[int, int] = {}
        result = []
        for operation, args in zip(operations, arguments, strict=True):
            if operation == "add":
                tasks[args[0]] = args[1]
                result.append(-1)
            elif operation == "pop":
                if not tasks:
                    result.append(-1)
                else:
                    task = min(tasks, key=lambda item: (-tasks[item], item))
                    del tasks[task]
                    result.append(task)
            elif operation == "cancel":
                result.append(int(tasks.pop(args[0], None) is not None))
            else:
                result.append(len(tasks))
        return result

    if kind == "key-value-store":
        store: dict[int, int] = {}
        result = []
        for operation, args in zip(operations, arguments, strict=True):
            if operation == "put":
                store[args[0]] = args[1]
                result.append(-1)
            elif operation == "get":
                result.append(store.get(args[0], -1))
            elif operation == "delete":
                result.append(int(store.pop(args[0], None) is not None))
            else:
                result.append(int(args[0] in store))
        return result

    if kind == "snapshot-array":
        current: list[int] = []
        snapshots: list[list[int]] = []
        result = []
        for operation, args in zip(operations, arguments, strict=True):
            if operation == "init":
                current = [0] * args[0]
                snapshots.clear()
                result.append(-1)
            elif operation == "set":
                current[args[0]] = args[1]
                result.append(-1)
            elif operation == "snap":
                snapshots.append(current[:])
                result.append(len(snapshots) - 1)
            else:
                result.append(snapshots[args[1]][args[0]])
        return result

    if kind == "time-map":
        store: dict[int, list[tuple[int, int]]] = defaultdict(list)
        result = []
        for operation, args in zip(operations, arguments, strict=True):
            if operation == "set":
                key, value, timestamp = args
                store[key].append((timestamp, value))
                result.append(-1)
            else:
                key, timestamp = args
                candidates = [value for time, value in store[key] if time <= timestamp]
                result.append(candidates[-1] if candidates else -1)
        return result

    if kind == "leaderboard":
        scores: Counter[int] = Counter()
        result = []
        for operation, args in zip(operations, arguments, strict=True):
            if operation == "add":
                scores[args[0]] += args[1]
                result.append(-1)
            elif operation == "top":
                result.append(sum(sorted(scores.values(), reverse=True)[: args[0]]))
            else:
                scores.pop(args[0], None)
                result.append(-1)
        return result

    if kind == "autocomplete-index":
        entries: dict[int, tuple[int, int]] = {}
        result = []
        for operation, args in zip(operations, arguments, strict=True):
            if operation == "add":
                group, word, weight = args
                entries[word] = (group, weight)
                result.append(-1)
            else:
                group = args[0]
                matches = [
                    (weight, -word, word)
                    for word, (entry_group, weight) in entries.items()
                    if entry_group == group
                ]
                result.append(max(matches)[2] if matches else -1)
        return result

    if kind == "in-memory-file-system":
        parent: dict[int, int] = {0: -1}
        own_size: Counter[int] = Counter()
        result = []
        for operation, args in zip(operations, arguments, strict=True):
            if operation == "mkdir":
                parent[args[1]] = args[0]
                result.append(-1)
            elif operation == "write":
                own_size[args[0]] = args[1]
                result.append(-1)
            elif operation == "size":
                node = args[0]
                total = sum(
                    size
                    for item, size in own_size.items()
                    if _is_descendant(item, node, parent)
                )
                result.append(total)
            else:
                node = args[0]
                removed = [
                    item
                    for item in parent
                    if item != 0 and _is_descendant(item, node, parent)
                ]
                for item in removed:
                    parent.pop(item, None)
                    own_size.pop(item, None)
                result.append(len(removed))
        return result

    if kind == "pub-sub-broker":
        subscribers: dict[int, set[int]] = defaultdict(set)
        result = []
        for operation, args in zip(operations, arguments, strict=True):
            if operation == "subscribe":
                subscribers[args[0]].add(args[1])
                result.append(-1)
            elif operation == "unsubscribe":
                subscribers[args[0]].discard(args[1])
                result.append(-1)
            else:
                result.append(len(subscribers[args[0]]))
        return result

    if kind == "consistent-hash-ring":
        nodes: list[int] = []
        result = []
        for operation, args in zip(operations, arguments, strict=True):
            value = args[0]
            if operation == "add":
                if value not in nodes:
                    nodes.insert(bisect_left(nodes, value), value)
                result.append(-1)
            elif operation == "remove":
                if value in nodes:
                    nodes.remove(value)
                result.append(-1)
            else:
                if not nodes:
                    result.append(-1)
                else:
                    index = bisect_left(nodes, value)
                    result.append(nodes[index % len(nodes)])
        return result

    raise ValueError(f"Unknown design: {kind}")


def _is_descendant(node: int, ancestor: int, parent: dict[int, int]) -> bool:
    while node in parent and node != -1:
        if node == ancestor:
            return True
        node = parent[node]
    return False


def _design_scenario(kind: str, seed: int) -> tuple[list[str], list[list[int]]]:
    a, b, c = 1 + seed, 10 + seed, 20 + seed
    scenarios: dict[str, tuple[list[str], list[list[int]]]] = {
        "lru-cache": (
            ["init", "put", "put", "get", "put", "get", "get"],
            [[1 + seed % 3], [a, b], [a + 1, c], [a], [a + 2, c + 1], [a + 1], [a + 2]],
        ),
        "lfu-cache": (
            ["init", "put", "put", "get", "put", "get", "get"],
            [[2 + seed % 2], [a, b], [a + 1, c], [a], [a + 2, c + 1], [a + 1], [a + 2]],
        ),
        "ttl-cache": (
            ["put", "get", "get", "put", "purge", "get"],
            [
                [a, b, 5 + seed],
                [a, 2 + seed],
                [a, 6 + seed],
                [a + 1, c, 10 + seed],
                [11 + seed],
                [a + 1, 11 + seed],
            ],
        ),
        "fixed-window-rate-limiter": (
            ["allow"] * 6,
            [[a, seed + offset, 2 + seed % 2, 5] for offset in (0, 1, 2, 4, 5, 6)],
        ),
        "sliding-window-rate-limiter": (
            ["allow"] * 6,
            [[a, seed + offset, 2 + seed % 2, 5] for offset in (0, 1, 2, 5, 6, 9)],
        ),
        "token-bucket": (
            ["allow"] * 6,
            [[a, seed + offset, 2 + seed % 3, 1] for offset in (0, 0, 0, 1, 1, 3)],
        ),
        "leaky-bucket": (
            ["allow"] * 6,
            [[a, seed + offset, 2 + seed % 3, 1] for offset in (0, 0, 0, 1, 1, 3)],
        ),
        "hit-counter": (
            ["hit", "hit", "get", "hit", "get", "get"],
            [
                [seed + 1],
                [seed + 2],
                [seed + 2],
                [seed + 300],
                [seed + 300],
                [seed + 302],
            ],
        ),
        "moving-average": (
            ["init", "next", "next", "next", "next"],
            [[2 + seed % 3], [b], [c], [b + c], [seed]],
        ),
        "median-finder": (
            ["add", "add", "median", "add", "median", "add", "median"],
            [[b], [a], [], [c], [], [seed - 3], []],
        ),
        "min-stack": (
            ["push", "push", "min", "push", "top", "pop", "min"],
            [[b], [a], [], [c], [], [], []],
        ),
        "max-stack": (
            ["push", "push", "peekMax", "push", "popMax", "top", "pop"],
            [[a], [c], [], [b], [], [], []],
        ),
        "queue-two-stacks": (
            ["push", "push", "peek", "dequeue", "empty", "dequeue", "empty"],
            [[b], [c], [], [], [], [], []],
        ),
        "stack-two-queues": (
            ["push", "push", "top", "pop", "empty", "pop", "empty"],
            [[b], [c], [], [], [], [], []],
        ),
        "circular-queue": (
            ["init", "enQueue", "enQueue", "Rear", "isFull", "deQueue", "Front"],
            [[2 + seed % 2], [b], [c], [], [], [], []],
        ),
        "circular-deque": (
            [
                "init",
                "insertLast",
                "insertFront",
                "getFront",
                "getRear",
                "deleteLast",
                "isEmpty",
            ],
            [[2 + seed % 2], [b], [c], [], [], [], []],
        ),
        "browser-history": (
            ["init", "visit", "visit", "back", "forward", "visit", "back"],
            [[a], [b], [c], [1 + seed % 2], [1], [c + 1], [2]],
        ),
        "parking-lot": (
            ["init", "park", "park", "available", "leave", "available"],
            [[1 + seed, 1 + seed % 3, 2], [0], [0], [0], [0], [0]],
        ),
        "elevator-controller": (
            ["init", "request", "request", "step", "step", "floor", "step"],
            [[seed % 10], [2 + seed % 8], [9 - seed % 8], [], [], [], []],
        ),
        "vending-machine": (
            ["stock", "insert", "buy", "insert", "buy", "refund"],
            [[a, 2, 5 + seed % 4], [4], [a], [5], [a], []],
        ),
        "library-catalog": (
            [
                "add",
                "available",
                "borrow",
                "borrow",
                "available",
                "return",
                "available",
            ],
            [[a, 1 + seed % 3], [a], [a], [a], [a], [a], [a]],
        ),
        "priority-task-scheduler": (
            ["add", "add", "size", "pop", "add", "cancel", "pop"],
            [[a, 1 + seed % 5], [a + 1, 4], [], [], [a + 2, 3], [a], []],
        ),
        "key-value-store": (
            ["put", "get", "exists", "put", "get", "delete", "exists"],
            [[a, b], [a], [a], [a, c], [a], [a], [a]],
        ),
        "snapshot-array": (
            ["init", "set", "snap", "set", "get", "snap", "get"],
            [[3 + seed % 3], [0, b], [], [0, c], [0, 0], [], [0, 1]],
        ),
        "time-map": (
            ["set", "get", "get", "set", "get", "get"],
            [[a, b, 1], [a, 0], [a, 1], [a, c, 4], [a, 3], [a, 5]],
        ),
        "leaderboard": (
            ["add", "add", "top", "add", "top", "reset", "top"],
            [[a, b], [a + 1, c], [1], [a, 5], [2], [a + 1], [2]],
        ),
        "autocomplete-index": (
            ["add", "add", "query", "add", "query", "query"],
            [[a, b, 5], [a, c, 8], [a], [a + 1, c + 1, 9], [a], [a + 1]],
        ),
        "in-memory-file-system": (
            ["mkdir", "mkdir", "write", "size", "write", "size", "delete"],
            [[0, a], [a, a + 1], [a + 1, b], [a], [a, c], [0], [a]],
        ),
        "pub-sub-broker": (
            [
                "subscribe",
                "subscribe",
                "publish",
                "unsubscribe",
                "publish",
                "subscribe",
                "publish",
            ],
            [[a, b], [a, c], [a], [a, b], [a], [a + 1, b], [a + 1]],
        ),
        "consistent-hash-ring": (
            ["locate", "add", "add", "locate", "remove", "locate", "add", "locate"],
            [[b], [10], [30 + seed], [20], [10], [5], [2], [35]],
        ),
    }
    return scenarios[kind]


DESIGNS = (
    (
        "lru-cache",
        "Design an LRU Cache",
        "Evict the least recently accessed entry when a fixed-capacity key/value cache becomes full.",
        "init(capacity), put(key,value), get(key)",
    ),
    (
        "lfu-cache",
        "Design an LFU Cache",
        "Evict the least frequently used entry, breaking frequency ties by least recent access.",
        "init(capacity), put(key,value), get(key)",
    ),
    (
        "ttl-cache",
        "Design a TTL Cache",
        "Store values with absolute expiry times and make expired entries unreadable.",
        "put(key,value,expires), get(key,now), purge(now)",
    ),
    (
        "fixed-window-rate-limiter",
        "Design a Fixed-Window Rate Limiter",
        "Allow at most a configured number of requests per user in each fixed time window.",
        "allow(user,time,limit,window)",
    ),
    (
        "sliding-window-rate-limiter",
        "Design a Sliding-Window Rate Limiter",
        "Limit each user by counting accepted requests in the immediately preceding time window.",
        "allow(user,time,limit,window)",
    ),
    (
        "token-bucket",
        "Design a Token Bucket",
        "Refill tokens over elapsed time and consume one token per accepted request.",
        "allow(user,time,capacity,refillRate)",
    ),
    (
        "leaky-bucket",
        "Design a Leaky Bucket",
        "Drain queued work over time and reject requests when the bounded bucket is full.",
        "allow(user,time,capacity,leakRate)",
    ),
    (
        "hit-counter",
        "Design a Hit Counter",
        "Record timestamped hits and count only those in the trailing 300-second interval.",
        "hit(time), get(time)",
    ),
    (
        "moving-average",
        "Design a Moving Average",
        "Return the floor of the average across the most recent bounded window of values.",
        "init(size), next(value)",
    ),
    (
        "median-finder",
        "Design a Median Finder",
        "Accept streamed integers and return the lower median of all values seen so far.",
        "add(value), median()",
    ),
    (
        "min-stack",
        "Design a Min Stack",
        "Support stack operations plus constant-behavior minimum queries.",
        "push(value), pop(), top(), min()",
    ),
    (
        "max-stack",
        "Design a Max Stack",
        "Support stack operations, maximum lookup, and removal of the top-most maximum.",
        "push(value), pop(), top(), peekMax(), popMax()",
    ),
    (
        "queue-two-stacks",
        "Design a Queue Using Stacks",
        "Provide first-in-first-out behavior through a queue API.",
        "push(value), dequeue(), peek(), empty()",
    ),
    (
        "stack-two-queues",
        "Design a Stack Using Queues",
        "Provide last-in-first-out behavior through a stack API.",
        "push(value), pop(), top(), empty()",
    ),
    (
        "circular-queue",
        "Design a Circular Queue",
        "Implement a fixed-capacity queue with front, rear, empty, and full queries.",
        "init(capacity), enQueue(value), deQueue(), Front(), Rear(), isEmpty(), isFull()",
    ),
    (
        "circular-deque",
        "Design a Circular Deque",
        "Implement fixed-capacity insertion and deletion at both ends.",
        "init(capacity), insertFront(value), insertLast(value), deleteFront(), deleteLast(), getFront(), getRear(), isEmpty(), isFull()",
    ),
    (
        "browser-history",
        "Design Browser History",
        "Track visits and bounded back/forward navigation, dropping forward history after a new visit.",
        "init(page), visit(page), back(steps), forward(steps)",
    ),
    (
        "parking-lot",
        "Design a Parking Lot",
        "Track small, medium, and large spot capacity as vehicles enter and leave.",
        "init(small,medium,large), park(type), leave(type), available(type)",
    ),
    (
        "elevator-controller",
        "Design an Elevator Controller",
        "Queue floor requests and move one floor per step toward the nearest pending request.",
        "init(floor), request(floor), step(), floor()",
    ),
    (
        "vending-machine",
        "Design a Vending Machine",
        "Track inventory, prices, inserted credit, purchases, and refunds.",
        "stock(item,count,price), insert(amount), buy(item), refund()",
    ),
    (
        "library-catalog",
        "Design a Library Catalog",
        "Track available copies while books are added, borrowed, and returned.",
        "add(book,copies), borrow(book), return(book), available(book)",
    ),
    (
        "priority-task-scheduler",
        "Design a Priority Task Scheduler",
        "Run the highest-priority task first with stable numeric tie-breaking and cancellation.",
        "add(task,priority), pop(), cancel(task), size()",
    ),
    (
        "key-value-store",
        "Design an In-Memory Key/Value Store",
        "Support overwrite, lookup, deletion, and existence checks for integer keys.",
        "put(key,value), get(key), delete(key), exists(key)",
    ),
    (
        "snapshot-array",
        "Design a Snapshot Array",
        "Capture immutable versions of an integer array and query values by snapshot id.",
        "init(length), set(index,value), snap(), get(index,snapshot)",
    ),
    (
        "time-map",
        "Design a Time-Based Key/Value Store",
        "Return the value with the greatest timestamp not exceeding the requested timestamp.",
        "set(key,value,time), get(key,time)",
    ),
    (
        "leaderboard",
        "Design a Leaderboard",
        "Accumulate player scores, sum the top k, and reset players.",
        "add(player,score), top(k), reset(player)",
    ),
    (
        "autocomplete-index",
        "Design an Autocomplete Index",
        "Index weighted word ids by prefix-group id and return the highest-ranked matching word.",
        "add(group,word,weight), query(group)",
    ),
    (
        "in-memory-file-system",
        "Design an In-Memory File System",
        "Maintain a directory tree, file sizes, recursive size queries, and subtree deletion.",
        "mkdir(parent,id), write(id,size), size(id), delete(id)",
    ),
    (
        "pub-sub-broker",
        "Design a Publish/Subscribe Broker",
        "Manage topic subscriptions and report delivery fan-out for published events.",
        "subscribe(topic,user), unsubscribe(topic,user), publish(topic)",
    ),
    (
        "consistent-hash-ring",
        "Design a Consistent Hash Ring",
        "Add and remove node positions, then route keys clockwise with wraparound.",
        "add(node), remove(node), locate(key)",
    ),
)


def _design_problems(Problem: Any) -> tuple[Any, ...]:
    problems = []
    for index, (kind, title, summary, protocol) in enumerate(DESIGNS, 1):
        reference = lambda operations, arguments, design=kind: simulate_design(
            design, operations, arguments
        )
        problems.append(
            Problem(
                10_000 + index,
                f"lld-{kind}",
                title,
                "Design",
                ("Low-Level Design", "Data Structures"),
                summary,
                (
                    f"Supported protocol: {protocol}.",
                    "Return one integer per operation; use -1 for operations without a value.",
                    "Operation names and argument rows align by index.",
                ),
                (("operations", "String[]"), ("arguments", "int[][]")),
                "int[]",
                reference,
                tuple(_design_scenario(kind, seed) for seed in range(20)),
                category="Low-Level Design",
            )
        )
    return tuple(problems)


def build_expansion(Problem: Any, unique_twenty: Any) -> tuple[Any, ...]:
    return (*_algorithm_problems(Problem, unique_twenty), *_design_problems(Problem))
