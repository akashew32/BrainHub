from __future__ import annotations

import re
from bisect import bisect_right
from collections import Counter, defaultdict, deque
from functools import cache
from heapq import heappop, heappush
from math import gcd
from typing import Any

MOD = 1_000_000_007


def ref_remove_element(nums: list[int], value: int) -> list[int]:
    return [item for item in nums if item != value]


def ref_excel_title(number: int) -> str:
    result = ""
    while number:
        number -= 1
        result = chr(65 + number % 26) + result
        number //= 26
    return result


def ref_excel_number(title: str) -> int:
    result = 0
    for char in title:
        result = result * 26 + ord(char) - 64
    return result


def ref_power_two(value: int) -> bool:
    return value > 0 and value & (value - 1) == 0


def ref_ugly(value: int) -> bool:
    if value <= 0:
        return False
    for factor in (2, 3, 5):
        while value % factor == 0:
            value //= factor
    return value == 1


def ref_first_unique(text: str) -> int:
    counts = Counter(text)
    return next((index for index, char in enumerate(text) if counts[char] == 1), -1)


def ref_third_maximum(nums: list[int]) -> int:
    values = sorted(set(nums), reverse=True)
    return values[2] if len(values) >= 3 else values[0]


def ref_number_complement(value: int) -> int:
    if value == 0:
        return 1
    mask = (1 << value.bit_length()) - 1
    return value ^ mask


def ref_max_consecutive_ones(nums: list[int]) -> int:
    best = current = 0
    for value in nums:
        current = current + 1 if value == 1 else 0
        best = max(best, current)
    return best


def ref_detect_capital(word: str) -> bool:
    return word.isupper() or word.islower() or word[:1].isupper() and word[1:].islower()


def ref_attendance(record: str) -> bool:
    return record.count("A") < 2 and "LLL" not in record


def ref_reshape(matrix: list[list[int]], rows: int, columns: int) -> list[list[int]]:
    flat = [value for row in matrix for value in row]
    if rows * columns != len(flat):
        return matrix
    return [flat[index : index + columns] for index in range(0, len(flat), columns)]


def ref_can_place(flowers: list[int], count: int) -> bool:
    planted = flowers[:]
    for index in range(len(planted)):
        if (
            planted[index] == 0
            and (index == 0 or planted[index - 1] == 0)
            and (index + 1 == len(planted) or planted[index + 1] == 0)
        ):
            planted[index] = 1
            count -= 1
    return count <= 0


def ref_max_product_three(nums: list[int]) -> int:
    values = sorted(nums)
    return max(values[-1] * values[-2] * values[-3], values[0] * values[1] * values[-1])


def ref_disappeared(nums: list[int]) -> list[int]:
    present = set(nums)
    return [value for value in range(1, len(nums) + 1) if value not in present]


def ref_fraction(numerator: int, denominator: int) -> str:
    if numerator == 0:
        return "0"
    sign = "-" if (numerator < 0) != (denominator < 0) else ""
    numerator, denominator = abs(numerator), abs(denominator)
    whole, remainder = divmod(numerator, denominator)
    if remainder == 0:
        return f"{sign}{whole}"
    digits: list[str] = []
    positions: dict[int, int] = {}
    while remainder and remainder not in positions:
        positions[remainder] = len(digits)
        remainder *= 10
        digit, remainder = divmod(remainder, denominator)
        digits.append(str(digit))
    if remainder:
        start = positions[remainder]
        digits.insert(start, "(")
        digits.append(")")
    return f"{sign}{whole}." + "".join(digits)


def _truncate_division(first: int, second: int) -> int:
    magnitude = abs(first) // abs(second)
    return -magnitude if (first < 0) != (second < 0) else magnitude


def ref_calculator_two(expression: str) -> int:
    stack: list[int] = []
    number = 0
    operation = "+"
    for char in expression + "+":
        if char.isdigit():
            number = number * 10 + int(char)
        if char in "+-*/":
            if operation == "+":
                stack.append(number)
            elif operation == "-":
                stack.append(-number)
            elif operation == "*":
                stack[-1] *= number
            else:
                stack[-1] = _truncate_division(stack[-1], number)
            operation = char
            number = 0
    return sum(stack)


def ref_bulls(secret: str, guess: str) -> str:
    bulls = sum(first == second for first, second in zip(secret, guess, strict=True))
    common = sum((Counter(secret) & Counter(guess)).values())
    return f"{bulls}A{common - bulls}B"


def ref_increasing_triplet(nums: list[int]) -> bool:
    first = second = float("inf")
    for value in nums:
        if value <= first:
            first = value
        elif value <= second:
            second = value
        else:
            return True
    return False


def ref_water_jug(first: int, second: int, target: int) -> bool:
    if target == 0:
        return True
    if first + second < target:
        return False
    return target % gcd(first, second) == 0 if first or second else False


def ref_integer_replacement(value: int) -> int:
    @cache
    def visit(number: int) -> int:
        if number == 1:
            return 0
        if number % 2 == 0:
            return 1 + visit(number // 2)
        return 1 + min(visit(number - 1), visit(number + 1))

    return visit(value)


def ref_reconstruct_queue(people: list[list[int]]) -> list[list[int]]:
    result: list[list[int]] = []
    for height, ahead in sorted(people, key=lambda person: (-person[0], person[1])):
        result.insert(ahead, [height, ahead])
    return result


def ref_find_duplicates(nums: list[int]) -> list[int]:
    return sorted(value for value, count in Counter(nums).items() if count == 2)


def ref_minimum_moves(nums: list[int]) -> int:
    median = sorted(nums)[len(nums) // 2]
    return sum(abs(value - median) for value in nums)


def ref_validate_ip(address: str) -> str:
    if address.count(".") == 3:
        pieces = address.split(".")
        if all(
            piece.isdigit()
            and (piece == "0" or not piece.startswith("0"))
            and 0 <= int(piece) <= 255
            for piece in pieces
        ):
            return "IPv4"
    if address.count(":") == 7:
        pieces = address.split(":")
        hexadecimal = set("0123456789abcdefABCDEF")
        if all(1 <= len(piece) <= 4 and set(piece) <= hexadecimal for piece in pieces):
            return "IPv6"
    return "Neither"


def ref_total_hamming(nums: list[int]) -> int:
    return sum(
        ones * (len(nums) - ones)
        for bit in range(31)
        if (ones := sum(value >> bit & 1 for value in nums))
    )


def ref_next_greater(nums: list[int]) -> list[int]:
    result = [-1] * len(nums)
    stack: list[int] = []
    for index in range(2 * len(nums)):
        value = nums[index % len(nums)]
        while stack and nums[stack[-1]] < value:
            result[stack.pop()] = value
        if index < len(nums):
            stack.append(index)
    return result


def ref_beautiful_arrangement(size: int) -> int:
    @cache
    def visit(position: int, used: int) -> int:
        if position > size:
            return 1
        return sum(
            visit(position + 1, used | 1 << value)
            for value in range(1, size + 1)
            if not used >> value & 1
            and (value % position == 0 or position % value == 0)
        )

    return visit(1, 0)


def ref_exclusive_time(functions: int, logs: list[str]) -> list[int]:
    result = [0] * functions
    stack: list[int] = []
    previous = 0
    for log in logs:
        identifier_text, event, time_text = log.split(":")
        identifier, time = int(identifier_text), int(time_text)
        if event == "start":
            if stack:
                result[stack[-1]] += time - previous
            stack.append(identifier)
            previous = time
        else:
            result[stack.pop()] += time - previous + 1
            previous = time + 1
    return result


def ref_pair_chain(pairs: list[list[int]]) -> int:
    end = -(10**18)
    count = 0
    for first, second in sorted(pairs, key=lambda pair: pair[1]):
        if first > end:
            count += 1
            end = second
    return count


def _equation_side(expression: str) -> tuple[int, int]:
    coefficient = constant = 0
    for token in re.findall(r"[+-]?[^+-]+", expression):
        if token.endswith("x"):
            prefix = token[:-1]
            coefficient += (
                -1 if prefix == "-" else 1 if prefix in ("", "+") else int(prefix)
            )
        else:
            constant += int(token)
    return coefficient, constant


def ref_solve_equation(equation: str) -> str:
    left, right = equation.split("=")
    left_coefficient, left_constant = _equation_side(left)
    right_coefficient, right_constant = _equation_side(right)
    coefficient = left_coefficient - right_coefficient
    constant = right_constant - left_constant
    if coefficient == 0:
        return "Infinite solutions" if constant == 0 else "No solution"
    return f"x={constant // coefficient}"


def ref_maximum_swap(value: int) -> int:
    digits = list(str(value))
    last = {digit: index for index, digit in enumerate(digits)}
    for index, digit in enumerate(digits):
        for candidate in map(str, range(9, int(digit), -1)):
            if last.get(candidate, -1) > index:
                swap_index = last[candidate]
                digits[index], digits[swap_index] = digits[swap_index], digit
                return int("".join(digits))
    return value


def ref_matching_subsequences(text: str, words: list[str]) -> int:
    positions: dict[str, list[int]] = defaultdict(list)
    for index, char in enumerate(text):
        positions[char].append(index)
    result = 0
    for word in words:
        current = -1
        for char in word:
            candidates = positions[char]
            offset = bisect_right(candidates, current)
            if offset == len(candidates):
                break
            current = candidates[offset]
        else:
            result += 1
    return result


def ref_complex_product(first: str, second: str) -> str:
    first_real, first_imaginary = map(int, first[:-1].split("+"))
    second_real, second_imaginary = map(int, second[:-1].split("+"))
    real = first_real * second_real - first_imaginary * second_imaginary
    imaginary = first_real * second_imaginary + first_imaginary * second_real
    return f"{real}+{imaginary}i"


def ref_parentheses_score(text: str) -> int:
    score = depth = 0
    for index, char in enumerate(text):
        if char == "(":
            depth += 1
        else:
            depth -= 1
            if text[index - 1] == "(":
                score += 1 << depth
    return score


def ref_word_ladders(begin: str, end: str, words: list[str]) -> list[str]:
    available = set(words)
    if end not in available:
        return []
    parents: dict[str, set[str]] = defaultdict(set)
    level = {begin}
    found = False
    while level and not found:
        available -= level
        next_level: set[str] = set()
        for word in level:
            for index in range(len(word)):
                for char in "abcdefghijklmnopqrstuvwxyz":
                    candidate = word[:index] + char + word[index + 1 :]
                    if candidate not in available:
                        continue
                    parents[candidate].add(word)
                    next_level.add(candidate)
                    if candidate == end:
                        found = True
        level = next_level
    if not found:
        return []

    paths: list[list[str]] = []

    # Build in forward order explicitly to make the public String[] representation deterministic.
    def collect(word: str, reverse_path: list[str]) -> None:
        if word == begin:
            paths.append(list(reversed([*reverse_path, begin])))
            return
        for parent in sorted(parents[word]):
            collect(parent, [*reverse_path, word])

    collect(end, [])
    return sorted(">".join(path) for path in paths)


def ref_palindrome_pairs(words: list[str]) -> list[list[int]]:
    return [
        [left, right]
        for left in range(len(words))
        for right in range(len(words))
        if left != right
        and (words[left] + words[right]) == (words[left] + words[right])[::-1]
    ]


def ref_ipo(
    projects: int, capital: int, profits: list[int], required: list[int]
) -> int:
    available: list[int] = []
    ordered = sorted(zip(required, profits, strict=True))
    index = 0
    for _ in range(projects):
        while index < len(ordered) and ordered[index][0] <= capital:
            heappush(available, -ordered[index][1])
            index += 1
        if not available:
            break
        capital -= heappop(available)
    return capital


def ref_repetitions(
    first: str, first_count: int, second: str, second_count: int
) -> int:
    if not set(second) <= set(first):
        return 0
    second_index = matches = 0
    for char in first * first_count:
        if char == second[second_index]:
            second_index += 1
            if second_index == len(second):
                matches += 1
                second_index = 0
    return matches // second_count


def _collapse_zuma(board: str) -> str:
    changed = True
    while changed:
        changed = False
        pieces: list[str] = []
        index = 0
        while index < len(board):
            end = index
            while end < len(board) and board[end] == board[index]:
                end += 1
            if end - index >= 3:
                changed = True
            else:
                pieces.append(board[index:end])
            index = end
        board = "".join(pieces)
    return board


def ref_zuma(board: str, hand: str) -> int:
    colors = "RYBGW"
    initial = tuple(Counter(hand)[color] for color in colors)

    @cache
    def visit(current: str, counts: tuple[int, ...]) -> int:
        current = _collapse_zuma(current)
        if not current:
            return 0
        best = 10**9
        index = 0
        while index < len(current):
            end = index
            while end < len(current) and current[end] == current[index]:
                end += 1
            color_index = colors.index(current[index])
            needed = 3 - (end - index)
            if counts[color_index] >= needed:
                next_counts = list(counts)
                next_counts[color_index] -= needed
                remainder = visit(current[:index] + current[end:], tuple(next_counts))
                if remainder >= 0:
                    best = min(best, needed + remainder)
            index = end
        return -1 if best == 10**9 else best

    return visit(board, initial)


def ref_stickers(stickers: list[str], target: str) -> int:
    sticker_counts = [Counter(sticker) for sticker in stickers]

    @cache
    def visit(remaining: str) -> int:
        if not remaining:
            return 0
        needed = Counter(remaining)
        best = 10**9
        for sticker in sticker_counts:
            if sticker[remaining[0]] == 0:
                continue
            next_word = "".join(
                char * max(0, count - sticker[char])
                for char, count in sorted(needed.items())
            )
            attempt = visit(next_word)
            if attempt >= 0:
                best = min(best, 1 + attempt)
        return -1 if best == 10**9 else best

    return visit("".join(sorted(target)))


def ref_falling_squares(positions: list[list[int]]) -> list[int]:
    intervals: list[tuple[int, int, int]] = []
    result: list[int] = []
    maximum = 0
    for left, size in positions:
        right = left + size
        base = 0
        for other_left, other_right, height in intervals:
            if left < other_right and other_left < right:
                base = max(base, height)
        height = base + size
        intervals.append((left, right, height))
        maximum = max(maximum, height)
        result.append(maximum)
    return result


def ref_redundant_directed(edges: list[list[int]]) -> list[int]:
    size = len(edges)
    parent = list(range(size + 1))
    candidate_one: list[int] | None = None
    candidate_two: list[int] | None = None
    skipped = -1
    incoming = [0] * (size + 1)
    for index, (source, target) in enumerate(edges):
        if incoming[target]:
            candidate_one = [incoming[target], target]
            candidate_two = [source, target]
            skipped = index
        else:
            incoming[target] = source

    def find(node: int) -> int:
        while parent[node] != node:
            parent[node] = parent[parent[node]]
            node = parent[node]
        return node

    for index, (source, target) in enumerate(edges):
        if index == skipped:
            continue
        source_root, target_root = find(source), find(target)
        if source_root == target_root:
            return candidate_one if candidate_one is not None else [source, target]
        parent[target_root] = source_root
    if candidate_two is None:
        raise AssertionError("Expected a redundant edge")
    return candidate_two


def ref_three_subarrays(nums: list[int], width: int) -> list[int]:
    window = sum(nums[:width])
    sums = [window]
    for index in range(width, len(nums)):
        window += nums[index] - nums[index - width]
        sums.append(window)
    left = [0] * len(sums)
    best = 0
    for index in range(len(sums)):
        if sums[index] > sums[best]:
            best = index
        left[index] = best
    right = [0] * len(sums)
    best = len(sums) - 1
    for index in range(len(sums) - 1, -1, -1):
        if sums[index] >= sums[best]:
            best = index
        right[index] = best
    answer = [0, width, width * 2]
    best_total = -1
    for middle in range(width, len(sums) - width):
        candidate = [left[middle - width], middle, right[middle + width]]
        total = sum(sums[index] for index in candidate)
        if total > best_total:
            best_total = total
            answer = candidate
    return answer


def ref_cut_trees(forest: list[list[int]]) -> int:
    if not forest or not forest[0]:
        return -1
    rows, columns = len(forest), len(forest[0])

    def distance(start: tuple[int, int], target: tuple[int, int]) -> int:
        queue = deque([(start[0], start[1], 0)])
        seen = {start}
        while queue:
            row, column, steps = queue.popleft()
            if (row, column) == target:
                return steps
            for row_step, column_step in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                next_row, next_column = row + row_step, column + column_step
                if (
                    0 <= next_row < rows
                    and 0 <= next_column < columns
                    and forest[next_row][next_column] != 0
                    and (next_row, next_column) not in seen
                ):
                    seen.add((next_row, next_column))
                    queue.append((next_row, next_column, steps + 1))
        return -1

    trees = sorted(
        (forest[row][column], row, column)
        for row in range(rows)
        for column in range(columns)
        if forest[row][column] > 1
    )
    current = (0, 0)
    result = 0
    for _, row, column in trees:
        steps = distance(current, (row, column))
        if steps < 0:
            return -1
        result += steps
        current = (row, column)
    return result


def ref_chessboard(board: list[list[int]]) -> int:
    size = len(board)
    if any(
        board[row][column] ^ board[0][column] ^ board[row][0] ^ board[0][0]
        for row in range(size)
        for column in range(size)
    ):
        return -1
    row_sum = sum(board[0])
    column_sum = sum(board[row][0] for row in range(size))
    if row_sum not in (size // 2, (size + 1) // 2) or column_sum not in (
        size // 2,
        (size + 1) // 2,
    ):
        return -1
    row_swaps = sum(board[row][0] == row % 2 for row in range(size))
    column_swaps = sum(board[0][column] == column % 2 for column in range(size))
    if size % 2:
        if row_swaps % 2:
            row_swaps = size - row_swaps
        if column_swaps % 2:
            column_swaps = size - column_swaps
    else:
        row_swaps = min(row_swaps, size - row_swaps)
        column_swaps = min(column_swaps, size - column_swaps)
    return (row_swaps + column_swaps) // 2


def ref_similar_groups(words: list[str]) -> int:
    parent = list(range(len(words)))

    def find(node: int) -> int:
        if parent[node] != node:
            parent[node] = find(parent[node])
        return parent[node]

    for left in range(len(words)):
        for right in range(left):
            differences = sum(
                a != b for a, b in zip(words[left], words[right], strict=True)
            )
            if differences in (0, 2):
                first, second = find(left), find(right)
                parent[first] = second
    return len({find(index) for index in range(len(words))})


def ref_visit_all(graph: list[list[int]]) -> int:
    size = len(graph)
    if size <= 1:
        return 0
    target = (1 << size) - 1
    queue = deque((node, 1 << node, 0) for node in range(size))
    seen = {(node, 1 << node) for node in range(size)}
    while queue:
        node, mask, steps = queue.popleft()
        for neighbor in graph[node]:
            next_mask = mask | 1 << neighbor
            if next_mask == target:
                return steps + 1
            state = (neighbor, next_mask)
            if state not in seen:
                seen.add(state)
                queue.append((neighbor, next_mask, steps + 1))
    return -1


def ref_profitable_schemes(
    members: int, minimum_profit: int, groups: list[int], profits: list[int]
) -> int:
    dp = [[0] * (minimum_profit + 1) for _ in range(members + 1)]
    dp[0][0] = 1
    for group, profit in zip(groups, profits, strict=True):
        for used in range(members, group - 1, -1):
            for earned in range(minimum_profit, -1, -1):
                dp[used][min(minimum_profit, earned + profit)] = (
                    dp[used][min(minimum_profit, earned + profit)]
                    + dp[used - group][earned]
                ) % MOD
    return sum(dp[used][minimum_profit] for used in range(members + 1)) % MOD


def ref_super_egg_drop(eggs: int, floors: int) -> int:
    reachable = [0] * (eggs + 1)
    moves = 0
    while reachable[eggs] < floors:
        moves += 1
        for egg in range(eggs, 0, -1):
            reachable[egg] = reachable[egg] + reachable[egg - 1] + 1
    return moves


def _queue_case(seed: int) -> tuple[list[list[int]]]:
    size = 2 + seed % 7
    order = [3 + ((seed * 5 + index * 7) % 31) for index in range(size)]
    while len(set(order)) < size:
        order = [value + index for index, value in enumerate(order)]
    people = [
        [height, sum(other >= height for other in order[:index])]
        for index, height in enumerate(order)
    ]
    rotation = seed % size
    return (people[rotation:] + people[:rotation],)


def _exclusive_case(seed: int) -> tuple[int, list[str]]:
    start = seed * 3
    inner_start = start + 1 + seed % 2
    inner_end = inner_start + 1 + seed % 3
    outer_end = inner_end + 1 + seed % 2
    return (
        2,
        [
            f"0:start:{start}",
            f"1:start:{inner_start}",
            f"1:end:{inner_end}",
            f"0:end:{outer_end}",
        ],
    )


def _directed_case(seed: int) -> tuple[list[list[int]]]:
    size = 3 + seed % 6
    edges = [[node, node + 1] for node in range(1, size)]
    if seed % 2:
        edges.append([size, 1 + seed % (size - 1)])
    else:
        target = 2 + seed % (size - 1)
        source = 1 + (seed * 3) % size
        if source == target:
            source = size
        edges.append([source, target])
    rotation = seed % len(edges)
    return (edges[rotation:] + edges[:rotation],)


def _forest_case(seed: int) -> tuple[list[list[int]]]:
    rows = 2 + seed % 3
    columns = 2 + (seed // 3) % 3
    forest = [[1 for _ in range(columns)] for _ in range(rows)]
    height = 2
    for row in range(rows):
        for column in range(columns):
            if (row + column * 2 + seed) % 5 == 0 and (row, column) != (0, 0):
                forest[row][column] = 0
            elif (row * columns + column + seed) % 2 == 0:
                forest[row][column] = height
                height += 1
    return (forest,)


def _chessboard_case(seed: int) -> tuple[list[list[int]]]:
    size = 2 + seed % 4
    board = [[(row + column) % 2 for column in range(size)] for row in range(size)]
    if seed % 3 == 1:
        board[0], board[-1] = board[-1], board[0]
    elif seed % 3 == 2:
        board[0][0] ^= 1
    if seed >= 12:
        board = [row[::-1] for row in board]
    return (board,)


def _connected_graph(seed: int) -> tuple[list[list[int]]]:
    size = 2 + seed % 6
    graph = [set() for _ in range(size)]
    for node in range(size):
        neighbor = (node + 1) % size
        graph[node].add(neighbor)
        graph[neighbor].add(node)
    if size > 3:
        graph[0].add(2)
        graph[2].add(0)
    if seed % 2 and size > 4:
        graph[1].add(size - 1)
        graph[size - 1].add(1)
    return ([sorted(neighbors) for neighbors in graph],)


def _ladder_case(seed: int) -> tuple[str, str, list[str]]:
    cube = [
        f"{first}{second}{third}" for first in "ab" for second in "ab" for third in "ab"
    ]
    distractor = chr(99 + seed % 20) + "aa"
    return "aaa", "bbb", [*cube[1:], distractor]


def _similar_case(seed: int) -> tuple[list[str]]:
    base = "abcd"
    words = {base}
    for left in range(len(base)):
        for right in range(left + 1, len(base)):
            chars = list(base)
            chars[left], chars[right] = chars[right], chars[left]
            if (left * 5 + right + seed) % 3:
                words.add("".join(chars))
    if seed % 2:
        words.add("badc")
    return (sorted(words),)


def build_more(Problem: Any, unique_twenty: Any) -> tuple[Any, ...]:
    twenty = lambda seeds, factory: unique_twenty(seeds, factory)

    easy = (
        Problem(
            27,
            "remove-element",
            "Remove Element",
            "Easy",
            ("Array", "Two Pointers"),
            "Return the values that remain after removing every occurrence of the target while preserving order.",
            ("The input may be empty.", "Remove every matching value."),
            (("nums", "int[]"), ("value", "int")),
            "int[]",
            ref_remove_element,
            twenty(
                [([3, 2, 2, 3], 3), ([0, 1, 2, 2, 3, 0, 4, 2], 2)],
                lambda i: (
                    [((i + index * 3) % 7) - 2 for index in range(i % 9)],
                    i % 6 - 2,
                ),
            ),
        ),
        Problem(
            168,
            "excel-sheet-column-title",
            "Excel Sheet Column Title",
            "Easy",
            ("Math", "String"),
            "Convert a positive one-indexed column number into its spreadsheet letter title.",
            ("The number is positive.", "Titles use uppercase A through Z."),
            (("number", "int"),),
            "String",
            ref_excel_title,
            tuple((1 + index * 137,) for index in range(20)),
        ),
        Problem(
            171,
            "excel-sheet-column-number",
            "Excel Sheet Column Number",
            "Easy",
            ("Math", "String"),
            "Convert an uppercase spreadsheet column title into its one-indexed number.",
            ("The title is nonempty.", "Letters range from A through Z."),
            (("title", "String"),),
            "int",
            ref_excel_number,
            tuple((ref_excel_title(1 + index * 149),) for index in range(20)),
        ),
        Problem(
            231,
            "power-of-two",
            "Power of Two",
            "Easy",
            ("Math", "Bit Manipulation"),
            "Decide whether the signed integer is an exact positive power of two.",
            ("Zero is not a power of two.", "Negative values return false."),
            (("value", "int"),),
            "boolean",
            ref_power_two,
            tuple(
                (value,)
                for value in [
                    -16,
                    -1,
                    0,
                    1,
                    2,
                    3,
                    4,
                    5,
                    7,
                    8,
                    15,
                    16,
                    31,
                    32,
                    63,
                    64,
                    127,
                    128,
                    255,
                    256,
                ]
            ),
        ),
        Problem(
            263,
            "ugly-number",
            "Ugly Number",
            "Easy",
            ("Math", "Number Theory"),
            "Determine whether every prime factor of a positive integer belongs to two, three, or five.",
            ("Nonpositive values return false.", "One is considered ugly."),
            (("value", "int"),),
            "boolean",
            ref_ugly,
            tuple(
                (value,)
                for value in [
                    1,
                    2,
                    3,
                    5,
                    6,
                    7,
                    8,
                    10,
                    14,
                    15,
                    25,
                    27,
                    30,
                    42,
                    45,
                    64,
                    75,
                    81,
                    125,
                    210,
                ]
            ),
        ),
        Problem(
            387,
            "first-unique-character-in-a-string",
            "First Unique Character in a String",
            "Easy",
            ("Hash Table", "String"),
            "Return the first index occupied by a character that occurs exactly once, or minus one.",
            ("The string may be empty.", "Character comparisons are case-sensitive."),
            (("text", "String"),),
            "int",
            ref_first_unique,
            twenty(
                [("leetcode",), ("loveleetcode",), ("aabb",), ("",)],
                lambda i: ("a" * (i % 5) + chr(98 + i % 20) + "a" * (i % 7),),
            ),
        ),
        Problem(
            414,
            "third-maximum-number",
            "Third Maximum Number",
            "Easy",
            ("Array", "Sorting"),
            "Return the third distinct maximum, or the maximum when fewer than three distinct values exist.",
            ("At least one value is present.", "Duplicate values count once."),
            (("nums", "int[]"),),
            "int",
            ref_third_maximum,
            twenty(
                [([3, 2, 1],), ([1, 2],), ([2, 2, 3, 1],)],
                lambda i: (
                    [((i * 5 + index * 7) % 17) - 8 for index in range(1 + i % 8)],
                ),
            ),
        ),
        Problem(
            476,
            "number-complement",
            "Number Complement",
            "Easy",
            ("Bit Manipulation",),
            "Flip every bit through the most significant one and return the resulting nonnegative integer.",
            ("Ignore leading zero bits.", "The input is nonnegative."),
            (("value", "int"),),
            "int",
            ref_number_complement,
            tuple((index * 37,) for index in range(20)),
        ),
        Problem(
            485,
            "max-consecutive-ones",
            "Max Consecutive Ones",
            "Easy",
            ("Array",),
            "Return the length of the longest contiguous run of ones in a binary array.",
            ("Values are zero or one.", "The array may be empty."),
            (("nums", "int[]"),),
            "int",
            ref_max_consecutive_ones,
            twenty(
                [([1, 1, 0, 1, 1, 1],), ([1, 0, 1, 1, 0, 1],), ([],)],
                lambda i: (
                    [
                        1 if (index * 3 + i) % (2 + i % 4) else 0
                        for index in range(i % 14)
                    ],
                ),
            ),
        ),
        Problem(
            520,
            "detect-capital",
            "Detect Capital",
            "Easy",
            ("String",),
            "Accept a word only when its capitalization is all upper, all lower, or title-style.",
            ("The word is nonempty.", "Only English letters are used."),
            (("word", "String"),),
            "boolean",
            ref_detect_capital,
            tuple(
                (word,)
                for word in [
                    "USA",
                    "leetcode",
                    "Google",
                    "FlaG",
                    "A",
                    "z",
                    "HELLO",
                    "Hello",
                    "heLlo",
                    "WORLD",
                    "World",
                    "worLD",
                    "Python",
                    "PYTHON",
                    "python",
                    "iPhone",
                    "X",
                    "BrainHub",
                    "BRAINHUB",
                    "brainhub",
                ]
            ),
        ),
        Problem(
            551,
            "student-attendance-record-i",
            "Student Attendance Record I",
            "Easy",
            ("String",),
            "Check whether a record contains fewer than two absences and never three consecutive late days.",
            ("P means present, A absent, and L late.", "The record may be empty."),
            (("record", "String"),),
            "boolean",
            ref_attendance,
            tuple(
                (record,)
                for record in [
                    "",
                    "P",
                    "A",
                    "L",
                    "PPALLP",
                    "PPALLL",
                    "AA",
                    "LLL",
                    "AL",
                    "LAL",
                    "PLPL",
                    "ALL",
                    "LALL",
                    "APLL",
                    "PLLAP",
                    "PPPP",
                    "LLLL",
                    "AALP",
                    "LLAPLL",
                    "PPLLP",
                ]
            ),
        ),
        Problem(
            566,
            "reshape-the-matrix",
            "Reshape the Matrix",
            "Easy",
            ("Array", "Matrix", "Simulation"),
            "Read entries row by row into the requested shape, returning the original matrix when impossible.",
            ("Rows remain in traversal order.", "Requested dimensions are positive."),
            (("matrix", "int[][]"), ("rows", "int"), ("columns", "int")),
            "int[][]",
            ref_reshape,
            twenty(
                [([[1, 2], [3, 4]], 1, 4), ([[1, 2], [3, 4]], 2, 4)],
                lambda i: (
                    [
                        [i * 10 + row * 3 + column for column in range(1 + i % 3)]
                        for row in range(1 + i % 4)
                    ],
                    1 + i % 5,
                    1 + (i * 2) % 6,
                ),
            ),
        ),
        Problem(
            605,
            "can-place-flowers",
            "Can Place Flowers",
            "Easy",
            ("Array", "Greedy"),
            "Decide whether the requested number of new flowers can be planted without adjacent occupied plots.",
            ("Plots are zero or one.", "Existing flowers are not adjacent."),
            (("flowerbed", "int[]"), ("count", "int")),
            "boolean",
            ref_can_place,
            twenty(
                [([1, 0, 0, 0, 1], 1), ([1, 0, 0, 0, 1], 2), ([], 0)],
                lambda i: (
                    [1 if index % (3 + i % 3) == 0 else 0 for index in range(i % 12)],
                    i % 5,
                ),
            ),
        ),
        Problem(
            628,
            "maximum-product-of-three-numbers",
            "Maximum Product of Three Numbers",
            "Easy",
            ("Array", "Sorting"),
            "Choose three values whose product is as large as possible.",
            ("At least three values are present.", "Negative values are allowed."),
            (("nums", "int[]"),),
            "int",
            ref_max_product_three,
            twenty(
                [([1, 2, 3],), ([1, 2, 3, 4],), ([-1, -2, -3],)],
                lambda i: (
                    [((i * 7 + index * 5) % 23) - 11 for index in range(3 + i % 8)],
                ),
            ),
        ),
        Problem(
            448,
            "find-all-numbers-disappeared-in-an-array",
            "Find All Numbers Disappeared in an Array",
            "Easy",
            ("Array", "Hash Table"),
            "Return every integer from one through n that does not occur in the length-n input.",
            (
                "Every input value lies from one through n.",
                "Return missing values in ascending order.",
            ),
            (("nums", "int[]"),),
            "int[]",
            ref_disappeared,
            twenty(
                [([4, 3, 2, 7, 8, 2, 3, 1],), ([1, 1],)],
                lambda i: (
                    [1 + ((index * 3 + i) % (1 + i % 9)) for index in range(1 + i % 9)],
                ),
            ),
        ),
    )

    medium = (
        Problem(
            166,
            "fraction-to-recurring-decimal",
            "Fraction to Recurring Decimal",
            "Medium",
            ("Math", "String"),
            "Write a rational number in decimal form, enclosing the repeating suffix in parentheses.",
            ("The denominator is nonzero.", "Use a leading minus sign when needed."),
            (("numerator", "int"), ("denominator", "int")),
            "String",
            ref_fraction,
            tuple(
                (((index * 17) % 61) - 30, 1 + (index * 7) % 19) for index in range(20)
            ),
        ),
        Problem(
            227,
            "basic-calculator-ii",
            "Basic Calculator II",
            "Medium",
            ("Math", "String", "Stack"),
            "Evaluate a nonnegative integer expression using addition, subtraction, multiplication, division, and spaces.",
            (
                "Division truncates toward zero.",
                "The expression contains no parentheses.",
            ),
            (("expression", "String"),),
            "int",
            ref_calculator_two,
            tuple(
                (f"{index + 2}*{index % 5 + 1}+{index * 3}- {index % 4 + 1}",)
                for index in range(20)
            ),
        ),
        Problem(
            299,
            "bulls-and-cows",
            "Bulls and Cows",
            "Medium",
            ("Hash Table", "String"),
            "Compare equal-length digit strings and report exact matches as bulls and displaced matches as cows.",
            ("Each position contributes at most once.", "Return the form xAyB."),
            (("secret", "String"), ("guess", "String")),
            "String",
            ref_bulls,
            tuple(
                (
                    f"{(index * 137 + 1234) % 10000:04d}",
                    f"{(index * 311 + 4321) % 10000:04d}",
                )
                for index in range(20)
            ),
        ),
        Problem(
            334,
            "increasing-triplet-subsequence",
            "Increasing Triplet Subsequence",
            "Medium",
            ("Array", "Greedy"),
            "Decide whether three positions in increasing index order also have strictly increasing values.",
            ("The positions need not be adjacent.", "Equal values do not increase."),
            (("nums", "int[]"),),
            "boolean",
            ref_increasing_triplet,
            twenty(
                [([1, 2, 3, 4, 5],), ([5, 4, 3, 2, 1],)],
                lambda i: (
                    [((i * 5 + index * 7) % 19) - 9 for index in range(i % 11)],
                ),
            ),
        ),
        Problem(
            365,
            "water-and-jug-problem",
            "Water and Jug Problem",
            "Medium",
            ("Math", "Number Theory"),
            "Determine whether exact target volume can be measured using two whole-capacity jugs.",
            ("Jugs may be filled, emptied, or poured.", "Capacities are nonnegative."),
            (("first", "int"), ("second", "int"), ("target", "int")),
            "boolean",
            ref_water_jug,
            tuple(
                (index % 11, (index * 3) % 13, (index * 5) % 18) for index in range(20)
            ),
        ),
        Problem(
            397,
            "integer-replacement",
            "Integer Replacement",
            "Medium",
            ("Dynamic Programming", "Greedy"),
            "Reach one in the fewest operations by halving even values or changing odd values by one.",
            (
                "The starting value is positive.",
                "All intermediate calculations use integers.",
            ),
            (("value", "int"),),
            "int",
            ref_integer_replacement,
            tuple((1 + index * 123,) for index in range(20)),
        ),
        Problem(
            406,
            "queue-reconstruction-by-height",
            "Queue Reconstruction by Height",
            "Medium",
            ("Array", "Greedy", "Sorting"),
            "Reconstruct the queue so each pair's second value equals the number of preceding people at least as tall.",
            ("Every pair is [height,ahead].", "A valid queue is guaranteed."),
            (("people", "int[][]"),),
            "int[][]",
            ref_reconstruct_queue,
            tuple(_queue_case(index) for index in range(20)),
        ),
        Problem(
            442,
            "find-all-duplicates-in-an-array",
            "Find All Duplicates in an Array",
            "Medium",
            ("Array", "Hash Table"),
            "Return each value that occurs exactly twice in an array whose values range from one through n.",
            ("Values appear once or twice.", "Return duplicates in ascending order."),
            (("nums", "int[]"),),
            "int[]",
            ref_find_duplicates,
            twenty(
                [([4, 3, 2, 7, 8, 2, 3, 1],), ([1, 1, 2],)],
                lambda i: (
                    [1 + ((index * 5 + i) % (2 + i % 8)) for index in range(2 + i % 8)],
                ),
            ),
        ),
        Problem(
            462,
            "minimum-moves-to-equal-array-elements-ii",
            "Minimum Moves to Equal Array Elements II",
            "Medium",
            ("Array", "Math", "Sorting"),
            "Increment or decrement single values until all are equal, minimizing total unit moves.",
            ("Negative values are allowed.", "Return the minimum move count."),
            (("nums", "int[]"),),
            "int",
            ref_minimum_moves,
            twenty(
                [([1, 2, 3],), ([1, 10, 2, 9],)],
                lambda i: (
                    [((i * 11 + index * 7) % 31) - 15 for index in range(1 + i % 10)],
                ),
            ),
        ),
        Problem(
            468,
            "validate-ip-address",
            "Validate IP Address",
            "Medium",
            ("String", "Simulation"),
            "Classify an address as canonical IPv4, canonical IPv6, or neither.",
            (
                "IPv4 components forbid leading zeroes.",
                "IPv6 components contain one to four hexadecimal digits.",
            ),
            (("address", "String"),),
            "String",
            ref_validate_ip,
            tuple(
                (address,)
                for address in [
                    "172.16.254.1",
                    "172.16.254.01",
                    "256.256.256.256",
                    "1e1.4.5.6",
                    "0.0.0.0",
                    "255.255.255.255",
                    "1.1.1",
                    "1.1.1.1.1",
                    "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
                    "2001:db8:85a3:0:0:8A2E:0370:7334",
                    "2001:db8:85a3::8A2E:037j:7334",
                    "02001:0db8:85a3:0000:0000:8a2e:0370:7334",
                    "::1",
                    "",
                    "abc",
                    "1.0.0.0",
                    "01.0.0.0",
                    "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff",
                    "ffff:ffff:ffff:ffff:ffff:ffff:ffff:gggg",
                    "1:2:3:4:5:6:7:8",
                ]
            ),
        ),
        Problem(
            477,
            "total-hamming-distance",
            "Total Hamming Distance",
            "Medium",
            ("Array", "Bit Manipulation"),
            "Sum the differing bit positions over every unordered pair of integers.",
            ("Values are nonnegative.", "Each pair is counted once."),
            (("nums", "int[]"),),
            "int",
            ref_total_hamming,
            twenty(
                [([4, 14, 2],), ([4, 14, 4],)],
                lambda i: (
                    [((i + index * 13) ** 2) % 1024 for index in range(i % 10)],
                ),
            ),
        ),
        Problem(
            503,
            "next-greater-element-ii",
            "Next Greater Element II",
            "Medium",
            ("Array", "Monotonic Stack"),
            "For each position in a circular array, return the first later value that is strictly greater.",
            (
                "Search wraps once around the array.",
                "Return minus one when no greater value exists.",
            ),
            (("nums", "int[]"),),
            "int[]",
            ref_next_greater,
            twenty(
                [([1, 2, 1],), ([1, 2, 3, 4, 3],)],
                lambda i: (
                    [((i * 7 + index * 5) % 17) - 8 for index in range(1 + i % 10)],
                ),
            ),
        ),
        Problem(
            526,
            "beautiful-arrangement",
            "Beautiful Arrangement",
            "Medium",
            ("Backtracking", "Bit Manipulation"),
            "Count permutations where every one-indexed position divides its value or is divisible by it.",
            (
                "Use each value from one through n exactly once.",
                "The size is at most fifteen.",
            ),
            (("size", "int"),),
            "int",
            ref_beautiful_arrangement,
            tuple((1 + index % 15,) for index in range(20)),
        ),
        Problem(
            636,
            "exclusive-time-of-functions",
            "Exclusive Time of Functions",
            "Medium",
            ("Array", "Stack", "Simulation"),
            "Compute each function's exclusive runtime from single-threaded nested start and inclusive-end logs.",
            ("Logs are chronologically ordered.", "Calls are properly nested."),
            (("functions", "int"), ("logs", "String[]")),
            "int[]",
            ref_exclusive_time,
            tuple(_exclusive_case(index) for index in range(20)),
        ),
        Problem(
            646,
            "maximum-length-of-pair-chain",
            "Maximum Length of Pair Chain",
            "Medium",
            ("Array", "Greedy", "Sorting"),
            "Choose the longest sequence of pairs where each next first value exceeds the previous second value.",
            ("Pairs may be reordered.", "Each pair has first less than second."),
            (("pairs", "int[][]"),),
            "int",
            ref_pair_chain,
            twenty(
                [([[1, 2], [2, 3], [3, 4]],), ([[1, 2], [7, 8], [4, 5]],)],
                lambda i: (
                    [
                        [index * 3 - i, index * 3 - i + 1 + i % 3]
                        for index in range(1 + i % 9)
                    ],
                ),
            ),
        ),
        Problem(
            640,
            "solve-the-equation",
            "Solve the Equation",
            "Medium",
            ("Math", "String", "Simulation"),
            "Solve a one-variable integer linear equation or identify no solution or infinitely many solutions.",
            (
                "Terms use x and integer constants.",
                "The equation contains one equals sign.",
            ),
            (("equation", "String"),),
            "String",
            ref_solve_equation,
            tuple(
                (
                    f"{1 + index % 5}x+{index * 2}={1 + index % 5}x+{index * 2}"
                    if index % 7 == 0
                    else f"{1 + index % 5}x+{index}={index * 3 + 2}",
                )
                for index in range(20)
            ),
        ),
        Problem(
            670,
            "maximum-swap",
            "Maximum Swap",
            "Medium",
            ("Math", "Greedy"),
            "Swap at most one pair of decimal digits to produce the largest possible integer.",
            ("The input is nonnegative.", "Leading zeroes are never introduced."),
            (("value", "int"),),
            "int",
            ref_maximum_swap,
            tuple(((index * 7919 + 2736) % 10_000_000,) for index in range(20)),
        ),
        Problem(
            792,
            "number-of-matching-subsequences",
            "Number of Matching Subsequences",
            "Medium",
            ("Hash Table", "String", "Binary Search"),
            "Count dictionary words that occur as subsequences of the source string, including duplicate words.",
            ("Character order must be preserved.", "Dictionary words may repeat."),
            (("text", "String"), ("words", "String[]")),
            "int",
            ref_matching_subsequences,
            twenty(
                [
                    ("abcde", ["a", "bb", "acd", "ace"]),
                    ("dsahjpjauf", ["ahjpjau", "ja", "ahbwzgqnuk", "tnmlanowax"]),
                ],
                lambda i: (
                    "abcde" + "x" * i,
                    ["a", "ace", "bd", "ee", "abcde"[: 1 + i % 5], "z" * (1 + i % 3)],
                ),
            ),
        ),
        Problem(
            537,
            "complex-number-multiplication",
            "Complex Number Multiplication",
            "Medium",
            ("Math", "String"),
            "Multiply two integer complex numbers written in a+bi form.",
            (
                "Real and imaginary components may be negative.",
                "Return the same a+bi form.",
            ),
            (("first", "String"), ("second", "String")),
            "String",
            ref_complex_product,
            tuple(
                (
                    f"{index - 10}+{index % 7 - 3}i",
                    f"{index % 9 - 4}+{index * 2 % 11 - 5}i",
                )
                for index in range(20)
            ),
        ),
        Problem(
            856,
            "score-of-parentheses",
            "Score of Parentheses",
            "Medium",
            ("String", "Stack"),
            "Score a balanced parentheses string where a primitive pair is one, concatenation adds, and nesting doubles.",
            ("The string is balanced.", "The string is nonempty."),
            (("text", "String"),),
            "int",
            ref_parentheses_score,
            tuple(
                (text,)
                for text in [
                    "()",
                    "(())",
                    "()()",
                    "(()(()))",
                    "((()))",
                    "()(())",
                    "(()())",
                    "((())())",
                    "()()()",
                    "(((())))",
                    "(()()())",
                    "(())()",
                    "()((()))",
                    "((()()))",
                    "(()(()))()",
                    "(())(())",
                    "((()))()",
                    "()(()())",
                    "((())(()))",
                    "(()())(())",
                ]
            ),
        ),
    )

    hard = (
        Problem(
            126,
            "word-ladder-ii",
            "Word Ladder II",
            "Hard",
            ("Hash Table", "String", "Breadth-First Search", "Backtracking"),
            "Return every shortest one-letter transformation sequence, encoding each path with greater-than separators.",
            (
                "Every intermediate word belongs to the dictionary.",
                "All words have equal length.",
            ),
            (("begin", "String"), ("end", "String"), ("words", "String[]")),
            "String[]",
            ref_word_ladders,
            twenty(
                [
                    ("hit", "cog", ["hot", "dot", "dog", "lot", "log", "cog"]),
                    ("hit", "cog", ["hot", "dot", "dog", "lot", "log"]),
                ],
                _ladder_case,
            ),
        ),
        Problem(
            336,
            "palindrome-pairs",
            "Palindrome Pairs",
            "Hard",
            ("Array", "Hash Table", "String"),
            "Return ordered pairs of distinct indexes whose concatenated words form palindromes.",
            ("Words are unique.", "Pair order matters."),
            (("words", "String[]"),),
            "int[][]",
            ref_palindrome_pairs,
            twenty(
                [(["abcd", "dcba", "lls", "s", "sssll"],), (["bat", "tab", "cat"],)],
                lambda i: (
                    [f"a{'b' * (1 + i % 4)}", f"{'b' * (1 + i % 4)}a", "", f"c{i}c"],
                ),
            ),
        ),
        Problem(
            502,
            "ipo",
            "IPO",
            "Hard",
            ("Array", "Greedy", "Heap", "Sorting"),
            "Complete at most k affordable projects, adding each chosen profit to available capital, and maximize final capital.",
            (
                "Each project is used at most once.",
                "Profit and capital arrays align by index.",
            ),
            (
                ("projects", "int"),
                ("capital", "int"),
                ("profits", "int[]"),
                ("required", "int[]"),
            ),
            "int",
            ref_ipo,
            twenty(
                [(2, 0, [1, 2, 3], [0, 1, 1]), (3, 0, [1, 2, 3], [0, 1, 2])],
                lambda i: (
                    1 + i % 6,
                    i % 4,
                    [1 + (i * 3 + j * 5) % 12 for j in range(1 + i % 8)],
                    [(i + j * 2) % 9 for j in range(1 + i % 8)],
                ),
            ),
        ),
        Problem(
            466,
            "count-the-repetitions",
            "Count The Repetitions",
            "Hard",
            ("String", "Dynamic Programming"),
            "Count how many copies of the second repeated block can be obtained as a subsequence of the first repeated block.",
            (
                "Strings are nonempty lowercase words.",
                "Repetition counts are positive.",
            ),
            (
                ("first", "String"),
                ("firstCount", "int"),
                ("second", "String"),
                ("secondCount", "int"),
            ),
            "int",
            ref_repetitions,
            twenty(
                [("acb", 4, "ab", 2), ("aaa", 3, "aa", 1)],
                lambda i: (
                    ["abc", "aab", "bca", "cab"][i % 4],
                    1 + i % 12,
                    ["a", "ab", "bc", "ca"][i % 4],
                    1 + i % 5,
                ),
            ),
        ),
        Problem(
            488,
            "zuma-game",
            "Zuma Game",
            "Hard",
            ("String", "Dynamic Programming", "Backtracking"),
            "Insert the fewest held balls needed to repeatedly clear runs of three equal colors and empty the board.",
            (
                "Colors are R, Y, B, G, or W.",
                "Return minus one when clearing is impossible.",
            ),
            (("board", "String"), ("hand", "String")),
            "int",
            ref_zuma,
            tuple(
                pair
                for pair in [
                    ("WRRBBW", "RB"),
                    ("WWRRBBWW", "WRBRW"),
                    ("G", "GGGGG"),
                    ("RBYYBBRRB", "YRBGB"),
                    ("R", "RR"),
                    ("RR", "R"),
                    ("RY", "RRY"),
                    ("RRGG", "RG"),
                    ("RGB", "RGB"),
                    ("YYBB", "YB"),
                    ("RRYY", "RYRY"),
                    ("BBGGBB", "GGB"),
                    ("W", "WW"),
                    ("RGGR", "GGR"),
                    ("RBBR", "BBR"),
                    ("YGGY", "GGY"),
                    ("RRYBB", "RYB"),
                    ("RGBRGB", "RGBRGB"),
                    ("WWGG", "WG"),
                    ("BRRB", "RRB"),
                ]
            ),
        ),
        Problem(
            691,
            "stickers-to-spell-word",
            "Stickers to Spell Word",
            "Hard",
            ("Array", "String", "Dynamic Programming", "Backtracking"),
            "Use the fewest reusable source stickers whose letters can be cut apart to assemble the target word.",
            (
                "Sticker letters may be rearranged.",
                "Return minus one when the target is impossible.",
            ),
            (("stickers", "String[]"), ("target", "String")),
            "int",
            ref_stickers,
            twenty(
                [
                    (["with", "example", "science"], "thehat"),
                    (["notice", "possible"], "basicbasic"),
                ],
                lambda i: (
                    ["ab", "bc", "ca", "abc"[: 1 + i % 3]],
                    "a" * (i + 1) + "bc",
                ),
            ),
        ),
        Problem(
            699,
            "falling-squares",
            "Falling Squares",
            "Hard",
            ("Array", "Segment Tree", "Ordered Set"),
            "Drop horizontal squares in order and return the maximum stack height after every landing.",
            ("Touching edges do not overlap.", "Each position is [left,size]."),
            (("positions", "int[][]"),),
            "int[]",
            ref_falling_squares,
            twenty(
                [([[1, 2], [2, 3], [6, 1]],), ([[100, 100], [200, 100]],)],
                lambda i: (
                    [
                        [1 + (i * 3 + j * 5) % 25, 1 + (i + j * 2) % 7]
                        for j in range(1 + i % 7)
                    ],
                ),
            ),
        ),
        Problem(
            685,
            "redundant-connection-ii",
            "Redundant Connection II",
            "Hard",
            ("Graph", "Union Find"),
            "Remove one directed edge so the remaining graph is a rooted tree, preferring the latest valid edge.",
            (
                "Exactly one extra edge was added.",
                "Nodes are labeled from one through n.",
            ),
            (("edges", "int[][]"),),
            "int[]",
            ref_redundant_directed,
            tuple(_directed_case(index) for index in range(20)),
        ),
        Problem(
            689,
            "maximum-sum-of-3-non-overlapping-subarrays",
            "Maximum Sum of 3 Non-Overlapping Subarrays",
            "Hard",
            ("Array", "Dynamic Programming", "Sliding Window"),
            "Return the lexicographically smallest starts of three disjoint fixed-width windows with maximum total sum.",
            ("Values are nonnegative.", "The array contains at least three windows."),
            (("nums", "int[]"), ("width", "int")),
            "int[]",
            ref_three_subarrays,
            twenty(
                [([1, 2, 1, 2, 6, 7, 5, 1], 2), ([1, 2, 1, 2, 1, 2, 1, 2, 1], 2)],
                lambda i: (
                    [1 + (i * 7 + j * 5) % 13 for j in range(9 + i % 10)],
                    1 + i % 3,
                ),
            ),
        ),
        Problem(
            675,
            "cut-off-trees-for-golf-event",
            "Cut Off Trees for Golf Event",
            "Hard",
            ("Array", "Breadth-First Search", "Heap", "Matrix"),
            "Starting at the top-left, visit every tree in increasing height order using four-direction walks through nonzero cells.",
            ("Zero cells are blocked.", "Return minus one if a tree is unreachable."),
            (("forest", "int[][]"),),
            "int",
            ref_cut_trees,
            tuple(_forest_case(index) for index in range(20)),
        ),
        Problem(
            782,
            "transform-to-chessboard",
            "Transform to Chessboard",
            "Hard",
            ("Array", "Math", "Matrix", "Bit Manipulation"),
            "Return the fewest row and column swaps needed to make adjacent cells alternate, or minus one.",
            (
                "A swap exchanges whole rows or columns.",
                "The board is square and binary.",
            ),
            (("board", "int[][]"),),
            "int",
            ref_chessboard,
            tuple(_chessboard_case(index) for index in range(20)),
        ),
        Problem(
            839,
            "similar-string-groups",
            "Similar String Groups",
            "Hard",
            ("Array", "String", "Union Find"),
            "Count connected groups where strings are linked when one swap can transform one into the other.",
            (
                "All words are anagrams of equal length.",
                "Similarity is transitive through groups.",
            ),
            (("words", "String[]"),),
            "int",
            ref_similar_groups,
            tuple(_similar_case(index) for index in range(20)),
        ),
        Problem(
            847,
            "shortest-path-visiting-all-nodes",
            "Shortest Path Visiting All Nodes",
            "Hard",
            (
                "Dynamic Programming",
                "Bit Manipulation",
                "Breadth-First Search",
                "Graph",
            ),
            "Return the shortest walk that visits every node of a connected undirected graph, allowing revisits.",
            (
                "The walk may start and end anywhere.",
                "Adjacency rows list node indexes.",
            ),
            (("graph", "int[][]"),),
            "int",
            ref_visit_all,
            tuple(_connected_graph(index) for index in range(20)),
        ),
        Problem(
            879,
            "profitable-schemes",
            "Profitable Schemes",
            "Hard",
            ("Array", "Dynamic Programming"),
            "Count job subsets using at most the member limit and earning at least the requested profit.",
            (
                "Each job is selected at most once.",
                "Return the count modulo 1,000,000,007.",
            ),
            (
                ("members", "int"),
                ("minimumProfit", "int"),
                ("groups", "int[]"),
                ("profits", "int[]"),
            ),
            "int",
            ref_profitable_schemes,
            twenty(
                [(5, 3, [2, 2], [2, 3]), (10, 5, [2, 3, 5], [6, 7, 8])],
                lambda i: (
                    1 + i % 10,
                    i % 9,
                    [1 + (i + j * 2) % 5 for j in range(1 + i % 7)],
                    [(i * 3 + j * 5) % 9 for j in range(1 + i % 7)],
                ),
            ),
        ),
        Problem(
            887,
            "super-egg-drop",
            "Super Egg Drop",
            "Hard",
            ("Math", "Dynamic Programming", "Binary Search"),
            "Find the minimum worst-case number of drops needed to identify the critical floor with a fixed egg count.",
            (
                "Egg behavior is consistent across floors.",
                "Both eggs and floors are positive.",
            ),
            (("eggs", "int"), ("floors", "int")),
            "int",
            ref_super_egg_drop,
            tuple((1 + index % 7, 1 + index * 17) for index in range(20)),
        ),
    )

    return (*easy, *medium, *hard)
