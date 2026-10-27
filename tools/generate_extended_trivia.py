from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "frontend" / "lib" / "extended-programming-questions.json"

PROMPTS = (
    "Which statement about {label} is correct?",
    "A technical review asks about {label}. Which answer is accurate?",
    "Choose the rule that best describes {label}.",
    "Which explanation of {label} would you trust?",
    "What is the key fact to remember about {label}?",
)


def fact(identifier, label, correct, wrong, explanation, code=""):
    return identifier, label, correct, wrong, explanation, code


PYTHON_LIBRARY_FUNDAMENTALS = (
    fact(
        "counter",
        "collections.Counter",
        "It is a dict subclass for hashable-item counts and returns zero for a missing count.",
        [
            "It keeps values sorted automatically.",
            "It accepts only strings.",
            "Missing keys raise KeyError on read.",
        ],
        "Counter specializes mapping behavior for frequency tables while retaining dictionary-style operations.",
        "from collections import Counter",
    ),
    fact(
        "defaultdict",
        "collections.defaultdict",
        "Its factory creates a value only when a missing key is accessed through normal indexing.",
        [
            "The factory runs for every read.",
            "It is immutable after construction.",
            "get() always invokes the factory.",
        ],
        "defaultdict implements __missing__ for indexed lookup; methods such as get do not call the factory.",
        "groups = defaultdict(list)",
    ),
    fact(
        "deque",
        "collections.deque",
        "It supports efficient appends and pops at both ends.",
        [
            "Random indexing is its primary constant-time operation.",
            "It is always sorted.",
            "It can store only one type.",
        ],
        "A deque uses block-linked storage optimized for queue and stack operations at either end.",
        "queue = deque()",
    ),
    fact(
        "namedtuple",
        "collections.namedtuple",
        "It creates tuple subclasses with named fields while preserving tuple immutability.",
        [
            "It creates mutable dictionaries.",
            "It requires a metaclass declaration.",
            "Its fields may be added after creation.",
        ],
        "Named tuples combine positional tuple behavior with generated attribute accessors.",
        "Point = namedtuple('Point', 'x y')",
    ),
    fact(
        "chain-map",
        "collections.ChainMap",
        "It presents several mappings as one lookup view, searching them from first to last.",
        [
            "It eagerly merges and copies every mapping.",
            "Writes update every underlying mapping.",
            "Lookup starts from the last mapping.",
        ],
        "ChainMap is useful for layered scopes; ordinary writes target its first mapping.",
        "settings = ChainMap(cli, env, defaults)",
    ),
    fact(
        "itertools-lazy",
        "itertools iterators",
        "Most itertools tools are lazy and produce values on demand.",
        [
            "They always return lists.",
            "They copy the entire input first.",
            "They can process only numeric data.",
        ],
        "Laziness lets itertools compose memory-efficient pipelines, including potentially infinite sequences.",
        "from itertools import islice",
    ),
    fact(
        "groupby",
        "itertools.groupby",
        "It groups consecutive equal-key runs, so global grouping usually requires sorting first.",
        [
            "It groups matching keys regardless of position.",
            "It returns a dictionary.",
            "Each group is an independent list immediately.",
        ],
        "groupby reacts to key changes in input order and yields group iterators sharing the source.",
        "for key, group in groupby(rows, key=key_fn): ...",
    ),
    fact(
        "product",
        "itertools.product",
        "It lazily emits the Cartesian product of its input pools.",
        [
            "It computes set intersection.",
            "It removes repeated tuples.",
            "It is equivalent to zip.",
        ],
        "product corresponds to nested loops and supports a repeat argument for repeated pools.",
        "product('AB', repeat=2)",
    ),
    fact(
        "lru-cache",
        "functools.lru_cache",
        "It memoizes calls using hashable arguments and can bound retained entries.",
        [
            "It caches only the most recent call.",
            "It works with unhashable list arguments automatically.",
            "It persists results across program restarts.",
        ],
        "lru_cache stores in-process results keyed by call arguments and exposes cache management methods.",
        "@lru_cache(maxsize=256)",
    ),
    fact(
        "partial",
        "functools.partial",
        "It creates a callable with selected positional or keyword arguments pre-filled.",
        [
            "It immediately calls the function.",
            "It edits the original function's bytecode.",
            "It can bind return values only.",
        ],
        "partial is a lightweight callable adapter that preserves the underlying function and stored arguments.",
        "base_two = partial(int, base=2)",
    ),
    fact(
        "pathlib",
        "pathlib.Path objects",
        "They represent filesystem paths and overload / for path composition.",
        [
            "They open every path during construction.",
            "They are strings with no filesystem methods.",
            "They work only on POSIX systems.",
        ],
        "Path offers object-oriented, platform-aware path manipulation; I/O occurs only when an I/O method is called.",
        "report = Path('out') / 'report.txt'",
    ),
    fact(
        "datetime-awareness",
        "naive and aware datetimes",
        "An aware datetime carries timezone offset information; a naive datetime does not.",
        [
            "Naive datetimes are always UTC.",
            "Aware datetimes cannot be compared.",
            "Timezone data is stored only in date objects.",
        ],
        "Timezone awareness determines whether a datetime identifies an unambiguous point on the timeline.",
        "datetime.now(timezone.utc)",
    ),
    fact(
        "decimal",
        "decimal.Decimal",
        "It performs configurable base-10 arithmetic and should usually be built from strings for exact decimal input.",
        [
            "It is a faster alias for float.",
            "It always uses binary floating point.",
            "Its precision cannot be configured.",
        ],
        "Decimal avoids many binary-float representation surprises and follows a context for precision and rounding.",
        "Decimal('0.1')",
    ),
    fact(
        "fractions",
        "fractions.Fraction",
        "It stores rational numbers as normalized numerator and denominator integers.",
        [
            "It approximates every value as a float.",
            "Its denominator may remain zero.",
            "It supports only unit fractions.",
        ],
        "Fraction provides exact rational arithmetic and reduces values by their greatest common divisor.",
        "Fraction(2, 6) == Fraction(1, 3)",
    ),
    fact(
        "regex-raw",
        "regular-expression string literals",
        "Raw strings reduce Python escape processing but do not change regex syntax itself.",
        [
            "Raw strings disable the regex engine.",
            "They may end with any single backslash.",
            "They make every character literal.",
        ],
        "Using r'...' keeps backslashes visible to re, though regex metacharacters still keep their regex meaning.",
        "pattern = r'\\d+'",
    ),
    fact(
        "json-types",
        "the json module's type mapping",
        "JSON objects become dicts, arrays become lists, and null becomes None by default.",
        [
            "JSON objects become tuples.",
            "Every number becomes Decimal automatically.",
            "JSON null raises ValueError.",
        ],
        "The standard decoder maps JSON's small type system onto ordinary Python container and scalar types.",
        "json.loads('{\"ok\": true}')",
    ),
    fact(
        "csv-newline",
        "opening CSV files",
        "The csv documentation recommends opening text files with newline='' so the module controls newline handling.",
        [
            "CSV files must be opened in binary mode.",
            "newline='' removes all row separators.",
            "The csv module accepts only in-memory strings.",
        ],
        "Delegating newline interpretation to csv avoids duplicated or misread line endings across platforms.",
        "open(path, newline='', encoding='utf-8')",
    ),
    fact(
        "dataclasses",
        "dataclasses",
        "@dataclass can generate initialization, representation, and comparison methods from annotated fields.",
        [
            "It makes every field deeply immutable.",
            "It removes type annotations at runtime.",
            "It requires inheritance from a framework base class.",
        ],
        "Dataclasses reduce boilerplate for data-focused classes; options control ordering, slots, and frozen assignment.",
        "@dataclass(frozen=True)",
    ),
    fact(
        "typing",
        "Python type annotations",
        "They are metadata used by tools and libraries; Python does not enforce them automatically at runtime.",
        [
            "They cause automatic runtime casts.",
            "They are removed before libraries can inspect them.",
            "They are valid only on function returns.",
        ],
        "Static checkers use annotations for analysis, while runtime validation requires explicit code or a validating library.",
        "def total(values: list[int]) -> int: ...",
    ),
    fact(
        "asyncio",
        "asyncio concurrency",
        "A single event loop cooperatively schedules coroutines when they await.",
        [
            "Every coroutine gets a new operating-system thread.",
            "await blocks the entire process until completion.",
            "asyncio can run only one coroutine total.",
        ],
        "Asyncio is suited to overlapping I/O; CPU-heavy work still needs another strategy to avoid blocking the loop.",
        "async def fetch(): ...",
    ),
)

PYTHON_LIBRARY_CALLS = (
    fact(
        "counter-most-common",
        "Counter.most_common()",
        "It returns element-count pairs ordered from most common to least common.",
        [
            "It returns only the counts.",
            "It mutates the Counter into sorted order.",
            "It drops ties nondeterministically by contract.",
        ],
        "An optional n limits the result to the n most common entries.",
        "Counter('abracadabra').most_common(2)",
    ),
    fact(
        "deque-rotate",
        "deque.rotate()",
        "A positive count moves rightmost items to the left; a negative count rotates the other way.",
        ["It sorts the deque.", "It returns a new deque.", "It removes rotated items."],
        "rotate mutates the deque cyclically and returns None.",
        "items.rotate(1)",
    ),
    fact(
        "itertools-accumulate",
        "itertools.accumulate()",
        "It yields running accumulated results and accepts an optional binary function.",
        [
            "It returns only the final total.",
            "It is identical to reduce in return shape.",
            "It requires sorted input.",
        ],
        "With addition, accumulate produces prefix sums; another associative-style operation may be supplied.",
        "list(accumulate([1, 2, 3]))",
    ),
    fact(
        "combinations",
        "itertools.combinations()",
        "It emits length-r subsequences without replacement and preserves input order.",
        [
            "It emits every permutation of each selection.",
            "It repeats each element arbitrarily.",
            "It requires numeric inputs.",
        ],
        "Combinations treat positions as unique and yield choices in lexicographic input-position order.",
        "combinations('ABCD', 2)",
    ),
    fact(
        "zip-longest",
        "itertools.zip_longest()",
        "It continues to the longest input and fills missing positions with fillvalue.",
        [
            "It stops at the shortest input like zip.",
            "It changes the original iterables.",
            "It rejects iterables of unequal length.",
        ],
        "zip_longest is useful for aligned traversal when missing values should be explicit.",
        "zip_longest(left, right, fillvalue=None)",
    ),
    fact(
        "cache-info",
        "an lru_cache wrapper's cache_info()",
        "It reports hits, misses, max size, and current size.",
        [
            "It clears the cache.",
            "It returns every cached argument and value.",
            "It writes cache data to disk.",
        ],
        "The named tuple helps observe memoization effectiveness without exposing cached entries.",
        "solve.cache_info()",
    ),
    fact(
        "path-read-text",
        "Path.read_text()",
        "It opens the path, reads text using the requested encoding, and closes the file.",
        [
            "It returns raw bytes only.",
            "It keeps the file handle open.",
            "It creates missing files automatically.",
        ],
        "read_text is a convenience for small text files; streaming is better for very large content.",
        "config = path.read_text(encoding='utf-8')",
    ),
    fact(
        "path-glob",
        "Path.glob()",
        "It yields paths below the receiver matching a shell-style pattern.",
        [
            "It searches file contents.",
            "It always recurses regardless of pattern.",
            "It returns plain strings only.",
        ],
        "Glob patterns select names; ** enables recursive matching when present in the pattern.",
        "root.glob('**/*.py')",
    ),
    fact(
        "strptime",
        "datetime.strptime()",
        "It parses a string according to an explicit format and returns a datetime.",
        [
            "It guesses every date format automatically.",
            "It always attaches UTC timezone information.",
            "It formats a datetime into a string.",
        ],
        "strptime is the parsing counterpart to strftime and raises ValueError when input does not match.",
        "datetime.strptime(text, '%Y-%m-%d')",
    ),
    fact(
        "timedelta",
        "datetime plus timedelta",
        "Adding a timedelta returns a shifted date or datetime without mutating the original.",
        [
            "It changes the original object in place.",
            "timedelta stores calendar months exactly.",
            "It works only with time objects.",
        ],
        "Date and datetime objects are immutable, while timedelta represents fixed durations in days, seconds, and microseconds.",
        "tomorrow = today + timedelta(days=1)",
    ),
    fact(
        "regex-fullmatch",
        "re.fullmatch()",
        "It succeeds only when the entire string matches the pattern.",
        [
            "It searches for a matching substring anywhere.",
            "It returns True or False only.",
            "It anchors only the beginning.",
        ],
        "fullmatch returns a match object or None and avoids separate start/end anchors for whole-string validation.",
        "re.fullmatch(r'[A-Z]{3}', symbol)",
    ),
    fact(
        "regex-finditer",
        "re.finditer()",
        "It lazily yields non-overlapping match objects with positions and captured groups.",
        [
            "It returns matched strings in one list.",
            "It finds overlapping matches automatically.",
            "It modifies the searched text.",
        ],
        "finditer retains match metadata while avoiding a list of all results up front.",
        "for match in re.finditer(pattern, text): ...",
    ),
    fact(
        "json-dumps",
        "json.dumps()",
        "It serializes supported Python values to a JSON string and can sort object keys.",
        [
            "It always writes directly to a file.",
            "It accepts every Python object automatically.",
            "It returns bytes by default.",
        ],
        "dumps is the string-producing counterpart to dump; custom objects need explicit conversion or an encoder.",
        "json.dumps(payload, sort_keys=True)",
    ),
    fact(
        "dict-reader",
        "csv.DictReader",
        "It yields each row as a mapping keyed by field names.",
        [
            "It yields dataclass instances automatically.",
            "It converts every numeric field to int.",
            "It ignores the header row and invents random keys.",
        ],
        "By default DictReader takes keys from the first row, while all field values remain strings unless converted.",
        "for row in csv.DictReader(handle): ...",
    ),
    fact(
        "heapq-pushpop",
        "heapq.heappushpop()",
        "It pushes an item and then removes and returns the smallest item more efficiently than separate calls.",
        [
            "It always returns the newly pushed item.",
            "It implements a max-heap by default.",
            "It sorts the whole list descending.",
        ],
        "heappushpop is useful for fixed-size min-heap workflows; heapreplace has different behavior for small new items.",
        "smallest = heapq.heappushpop(heap, item)",
    ),
    fact(
        "bisect-left",
        "bisect.bisect_left()",
        "It returns the leftmost insertion index that preserves sorted order.",
        [
            "It inserts the value itself.",
            "It searches unsorted data correctly.",
            "It returns -1 when the value is absent.",
        ],
        "bisect_left partitions existing values into those strictly less than the target and those greater or equal.",
        "index = bisect_left(values, target)",
    ),
    fact(
        "dataclass-replace",
        "dataclasses.replace()",
        "It creates a new dataclass instance with selected fields changed.",
        [
            "It mutates a frozen dataclass in place.",
            "It converts the object to a dictionary.",
            "It bypasses generated initialization.",
        ],
        "replace calls the dataclass initializer and is convenient for immutable-style updates.",
        "updated = replace(order, quantity=10)",
    ),
    fact(
        "asyncio-gather",
        "asyncio.gather()",
        "It waits for multiple awaitables concurrently and returns results in argument order.",
        [
            "It returns results in completion order only.",
            "It creates operating-system processes for each call.",
            "It can accept only already-finished tasks.",
        ],
        "gather schedules coroutine inputs and preserves positional result ordering despite different completion times.",
        "results = await asyncio.gather(fetch_a(), fetch_b())",
    ),
    fact(
        "sqlite-parameters",
        "sqlite3 parameter substitution",
        "Placeholders keep values separate from SQL text and are safer than string formatting.",
        [
            "Parameters may replace table names directly.",
            "String interpolation is equally safe for untrusted input.",
            "The module accepts only named placeholders.",
        ],
        "DB-API parameter binding handles quoting and reduces injection risk; identifiers still need controlled construction.",
        "cursor.execute('SELECT * FROM trades WHERE id = ?', (trade_id,))",
    ),
    fact(
        "pytest-raises",
        "pytest.raises()",
        "As a context manager it asserts that the enclosed code raises the expected exception.",
        [
            "It suppresses every exception type.",
            "It reruns the block until it passes.",
            "It compares only exception messages.",
        ],
        "pytest.raises fails the test if no matching exception occurs and can expose the captured exception for further checks.",
        "with pytest.raises(ValueError): parse('bad')",
    ),
)

ARCHITECTURE_FUNDAMENTALS = (
    fact(
        "binary-hex",
        "binary and hexadecimal notation",
        "One hexadecimal digit represents four binary bits.",
        [
            "One hexadecimal digit represents eight bits.",
            "Binary and hexadecimal use different stored values.",
            "Hexadecimal cannot represent signed values.",
        ],
        "Hex is a compact textual representation of bit patterns; conversion groups bits in sets of four.",
        "0xAF == 0b10101111",
    ),
    fact(
        "twos-complement",
        "two's-complement integers",
        "Negation in a fixed width can be formed by inverting bits and adding one.",
        [
            "The top bit is a separate sign with unchanged magnitude bits.",
            "There are two zero representations.",
            "Addition needs a different circuit for negative values.",
        ],
        "Two's complement provides one zero and lets ordinary binary addition handle signed values modulo the word size.",
        "8-bit -5 = 11111011",
    ),
    fact(
        "endianness",
        "endianness",
        "It specifies byte order for multi-byte values, not the bit order inside each byte.",
        [
            "It changes arithmetic results inside the CPU.",
            "It specifies cache replacement policy.",
            "It determines instruction width only.",
        ],
        "Little-endian stores the least-significant byte at the lowest address; big-endian does the opposite.",
        "0x12345678",
    ),
    fact(
        "isa",
        "an instruction set architecture",
        "It is the software-visible contract for instructions, registers, data types, and memory behavior.",
        [
            "It is one exact physical circuit layout.",
            "It defines only the programming language syntax.",
            "It is identical to a CPU's clock speed.",
        ],
        "Different microarchitectures can implement the same ISA while varying pipelines, caches, and execution resources.",
        "x86-64 and AArch64 are ISAs",
    ),
    fact(
        "microarchitecture",
        "microarchitecture",
        "It is a particular hardware organization used to implement an ISA.",
        [
            "It is the operating system API.",
            "It is fixed uniquely by the ISA.",
            "It contains no performance choices.",
        ],
        "Pipeline depth, issue width, cache sizes, and predictors are microarchitectural choices hidden behind the ISA contract.",
        "same ISA, different cores",
    ),
    fact(
        "registers",
        "CPU registers",
        "They are small, directly addressed storage locations close to execution units.",
        [
            "They are slower than main memory.",
            "They persist after power loss.",
            "They are managed in disk sectors.",
        ],
        "Registers hold operands, addresses, and control state with much lower access latency than memory.",
        "general-purpose register",
    ),
    fact(
        "alu",
        "the arithmetic logic unit",
        "It performs arithmetic and logical operations on operands.",
        [
            "It stores the full program permanently.",
            "It translates virtual pages to disk blocks.",
            "It schedules operating-system processes.",
        ],
        "ALUs implement operations such as add, subtract, shifts, comparisons, and bitwise logic.",
        "ADD r0, r1, r2",
    ),
    fact(
        "pipeline",
        "instruction pipelining",
        "It overlaps stages from different instructions to improve throughput.",
        [
            "It makes each individual instruction complete instantly.",
            "It removes every dependency hazard.",
            "It requires one instruction to finish before the next begins.",
        ],
        "A pipeline can retire more instructions per unit time even though a single instruction still traverses multiple stages.",
        "fetch → decode → execute → memory → writeback",
    ),
    fact(
        "data-hazard",
        "pipeline data hazards",
        "They arise when an instruction depends on a result that an earlier instruction has not produced yet.",
        [
            "They occur only after a cache miss.",
            "They are caused exclusively by interrupts.",
            "They disappear in every superscalar core.",
        ],
        "Forwarding, stalls, renaming, and scheduling are techniques for handling different dependency hazards.",
        "ADD r1,... then SUB ...,r1",
    ),
    fact(
        "control-hazard",
        "control hazards",
        "They occur when the next instruction address depends on an unresolved branch or jump.",
        [
            "They are arithmetic overflow events.",
            "They mean two cores wrote the same cache line.",
            "They apply only to data loads.",
        ],
        "Prediction and speculative fetching reduce branch-resolution bubbles when the prediction is correct.",
        "conditional branch",
    ),
    fact(
        "branch-prediction",
        "branch prediction",
        "It guesses control flow so the pipeline can continue before a branch is resolved.",
        [
            "It changes program-visible branch semantics.",
            "It guarantees no mispredictions.",
            "It is used only for unconditional jumps.",
        ],
        "A wrong prediction discards speculative work and pays a recovery penalty without changing correct architectural results.",
        "predict taken / not taken",
    ),
    fact(
        "cache-locality",
        "temporal and spatial locality",
        "Temporal locality reuses recent data; spatial locality accesses nearby addresses.",
        [
            "Temporal locality means sequential disk sectors only.",
            "Spatial locality means repeated access to one exact byte only.",
            "Caches benefit from neither pattern.",
        ],
        "Cache hierarchies exploit these common access patterns by retaining blocks near the processor.",
        "for i in range(n): array[i]",
    ),
    fact(
        "cache-lines",
        "cache lines",
        "Caches transfer and tag fixed-size blocks containing neighboring bytes.",
        [
            "Each line stores one arbitrary bit only.",
            "A line can belong to every set simultaneously.",
            "Line size has no effect on spatial locality.",
        ],
        "Line granularity amortizes metadata and exploits nearby accesses, but can also waste bandwidth or cause false sharing.",
        "64-byte line (common, not universal)",
    ),
    fact(
        "cache-mapping",
        "set-associative caches",
        "An address maps to one set and may occupy any way within that set.",
        [
            "Every block can occupy every line in the cache.",
            "Each set has exactly one byte.",
            "Tags are unnecessary.",
        ],
        "Set index selects a group, the tag identifies the memory block, and replacement chooses a way when the set is full.",
        "address = tag | set | offset",
    ),
    fact(
        "write-policy",
        "cache write policies",
        "Write-through updates the next level immediately; write-back delays it until eviction.",
        [
            "Write-back never marks lines dirty.",
            "Write-through writes only registers.",
            "Both policies forbid write allocation.",
        ],
        "Write policies trade traffic, complexity, and recovery behavior; dirty bits track modified write-back lines.",
        "write-back + write-allocate",
    ),
    fact(
        "virtual-memory",
        "virtual memory",
        "It gives processes virtual address spaces translated to physical memory by page mappings.",
        [
            "Every virtual address equals its physical address.",
            "It eliminates the need for protection.",
            "It stores only CPU instructions, not data.",
        ],
        "Virtual memory supports isolation, relocation, sharing, and demand paging through page tables and translation hardware.",
        "virtual page → physical frame",
    ),
    fact(
        "tlb",
        "the translation lookaside buffer",
        "It caches recent virtual-to-physical address translations.",
        [
            "It caches file contents from disk.",
            "It replaces every level of the data cache.",
            "It stores branch predictions.",
        ],
        "A TLB hit avoids a page-table walk, while a miss requires translation lookup and may still find the page resident.",
        "TLB entry",
    ),
    fact(
        "page-fault",
        "page faults",
        "They occur when address translation requires operating-system handling, including demand loading or protection failures.",
        [
            "They are identical to cache misses.",
            "They always terminate the process.",
            "They occur only when a CPU divides by zero.",
        ],
        "Some faults are resolved by mapping or loading a page; invalid accesses instead lead to an error signal or exception.",
        "not-present page-table entry",
    ),
    fact(
        "sram-dram",
        "SRAM versus DRAM",
        "SRAM is typically faster and denser in circuitry; DRAM is denser in bits and requires refresh.",
        [
            "DRAM uses no capacitive storage.",
            "SRAM requires periodic refresh.",
            "Both have identical cost and latency.",
        ],
        "On-chip caches commonly use SRAM while main memory commonly uses DRAM because of their different density and speed tradeoffs.",
        "cache SRAM, main-memory DRAM",
    ),
    fact(
        "interrupts",
        "hardware interrupts",
        "They asynchronously request processor attention and transfer control through an interrupt mechanism.",
        [
            "They can occur only at program termination.",
            "They are ordinary function calls with no privilege transition.",
            "They permanently erase register state.",
        ],
        "The processor saves defined state, enters an appropriate handler, and later resumes or schedules other work.",
        "device completion interrupt",
    ),
)

ARCHITECTURE_APPLIED = (
    fact(
        "amdahl",
        "Amdahl's law",
        "Overall speedup is limited by the fraction of work that cannot benefit from the improvement.",
        [
            "Parallel speedup is always equal to core count.",
            "The serial fraction becomes faster automatically.",
            "It applies only to memory size.",
        ],
        "Even infinite acceleration of the improved fraction leaves the unimproved fraction as a lower bound on runtime.",
        "speedup = 1 / ((1-p) + p/s)",
    ),
    fact(
        "cpi",
        "cycles per instruction",
        "Average CPI is a weighted average of instruction classes and their cycle costs.",
        [
            "CPI is always exactly one.",
            "Higher CPI always means faster execution.",
            "CPI is independent of stalls and misses.",
        ],
        "Execution time relates instruction count, CPI, and clock period; microarchitectural events can increase effective CPI.",
        "time = instructions × CPI × cycle_time",
    ),
    fact(
        "clock-rate",
        "clock rate and performance",
        "A higher clock rate alone does not guarantee a faster program because work per cycle and stalls also matter.",
        [
            "Clock rate fully determines execution time.",
            "Lower frequency always uses more power.",
            "All ISAs perform equal work per cycle.",
        ],
        "Performance comparisons need instruction count, IPC/CPI, memory behavior, and workload characteristics in addition to frequency.",
        "3 GHz versus 4 GHz",
    ),
    fact(
        "latency-throughput",
        "latency versus throughput",
        "Latency measures time for one operation; throughput measures completed operations per unit time.",
        [
            "They are always numerically identical.",
            "Pipelining improves latency only, never throughput.",
            "Throughput is the delay of one request.",
        ],
        "Systems can improve throughput by overlapping work even when single-operation latency changes little.",
        "requests/second versus milliseconds/request",
    ),
    fact(
        "cache-offset",
        "cache block-offset bits",
        "A power-of-two line size of B bytes needs log2(B) address bits for the byte offset.",
        [
            "Offset bits equal the total address width.",
            "Larger lines need fewer offset bits.",
            "Associativity determines byte-offset bits.",
        ],
        "The low-order address bits select a byte within the cache line.",
        "64-byte line → 6 offset bits",
    ),
    fact(
        "cache-set-count",
        "cache set count",
        "Sets equal capacity divided by line size and associativity.",
        [
            "Sets equal capacity times associativity.",
            "Line size does not matter.",
            "Every cache has one set.",
        ],
        "Capacity = sets × ways × bytes per line, excluding metadata.",
        "32 KiB / (64 B × 8 ways) = 64 sets",
    ),
    fact(
        "address-breakdown",
        "cache address fields",
        "Offset selects a byte, index selects a set, and tag distinguishes blocks mapping to that set.",
        [
            "Tag selects a byte within the line.",
            "Index is stored only on disk.",
            "Offset identifies the process.",
        ],
        "For power-of-two geometry, these fields partition the address bits used by the cache lookup.",
        "tag | index | offset",
    ),
    fact(
        "signed-overflow",
        "signed integer overflow",
        "In two's-complement hardware, overflow occurs when same-sign operands produce an opposite-sign result.",
        [
            "A carry out always means signed overflow.",
            "Opposite-sign addition always overflows.",
            "Overflow is impossible with fixed-width integers.",
        ],
        "Carry and signed overflow answer different questions; the sign relationship detects overflow for addition.",
        "01111111 + 00000001",
    ),
    fact(
        "alignment",
        "memory alignment",
        "Alignment places objects at addresses compatible with their size or architecture requirements.",
        [
            "Alignment compresses objects to zero bytes.",
            "Every byte address is equally efficient on all machines.",
            "Alignment applies only to instructions.",
        ],
        "Aligned access can simplify hardware and improve transfer efficiency; padding may be inserted between fields.",
        "address mod alignment == 0",
    ),
    fact(
        "page-offset",
        "page offsets",
        "Translation changes the page number while preserving the offset within the page.",
        [
            "The offset is looked up in a disk directory.",
            "Every byte has a separate page-table entry.",
            "The offset identifies the physical frame.",
        ],
        "Equal page sizes in virtual and physical memory let the low offset bits pass through unchanged.",
        "4 KiB page → 12 offset bits",
    ),
    fact(
        "simd",
        "SIMD execution",
        "One instruction applies the same operation across multiple packed data lanes.",
        [
            "It runs unrelated instructions in every lane.",
            "It is identical to multiple independent processes.",
            "It requires scalar data only.",
        ],
        "SIMD benefits data-parallel work when control flow and memory layout let lanes operate together.",
        "vector add of four integers",
    ),
    fact(
        "coherence",
        "cache coherence",
        "It coordinates cached copies so cores observe writes according to the coherence protocol.",
        [
            "It makes all multithreaded programs race-free.",
            "It replaces consistency models.",
            "It applies only to instruction caches.",
        ],
        "Protocols track line states and exchange invalidations or updates, but software still needs synchronization for data races.",
        "MESI-style states",
    ),
    fact(
        "false-sharing",
        "false sharing",
        "Independent variables on one cache line can cause coherence traffic when different cores write them.",
        [
            "It requires both threads to write the same variable.",
            "It improves scaling by sharing every line.",
            "It occurs only on single-core systems.",
        ],
        "Padding or data layout changes can separate hot write locations and reduce unnecessary line bouncing.",
        "two counters in one cache line",
    ),
    fact(
        "memory-order",
        "memory ordering",
        "Processors and compilers may reorder operations within rules, so synchronization establishes required visibility and order.",
        [
            "Source-code order is always globally observed.",
            "Caches make synchronization unnecessary.",
            "Ordering affects only arithmetic instructions.",
        ],
        "Atomics, locks, and fences express ordering constraints needed for correct concurrent communication.",
        "release store / acquire load",
    ),
    fact(
        "cas",
        "compare-and-swap",
        "It atomically updates a location only when its current value matches an expected value.",
        [
            "It swaps two unrelated memory ranges unconditionally.",
            "It is non-atomic by definition.",
            "It prevents every ABA scenario automatically.",
        ],
        "CAS is a building block for lock-free algorithms, usually used in a retry loop.",
        "if (*addr == expected) *addr = desired",
    ),
    fact(
        "dma",
        "direct memory access",
        "A DMA engine transfers data between a device and memory with limited per-byte CPU involvement.",
        [
            "It bypasses memory entirely.",
            "It executes application source code on the device.",
            "It removes the need for completion signaling.",
        ],
        "The CPU configures the transfer, and the device or controller typically signals completion later.",
        "storage device → RAM",
    ),
    fact(
        "system-call",
        "system calls",
        "They provide a controlled transition from user mode into privileged operating-system services.",
        [
            "They are ordinary user functions with unrestricted hardware access.",
            "They always restart the computer.",
            "They can run only during boot.",
        ],
        "A trap-like mechanism changes privilege and dispatches a kernel handler while preserving process context.",
        "read, write, mmap",
    ),
    fact(
        "speculation",
        "speculative execution",
        "The processor may execute predicted work before knowing it is needed, then commit only architecturally valid results.",
        [
            "Mispredicted work is always committed.",
            "It changes correct program outputs.",
            "It is limited to disk controllers.",
        ],
        "Speculation improves utilization but must recover on wrong predictions and has important side-channel considerations.",
        "out-of-order speculative load",
    ),
    fact(
        "roofline",
        "the roofline model",
        "Performance is bounded by compute throughput or memory bandwidth depending on arithmetic intensity.",
        [
            "Every workload is compute-bound.",
            "Memory bandwidth never limits kernels.",
            "Arithmetic intensity means clock frequency.",
        ],
        "Comparing operations per byte with machine balance indicates which resource ceiling is likely active.",
        "performance ≤ min(peak compute, bandwidth × intensity)",
    ),
    fact(
        "little-endian-read",
        "reading little-endian bytes",
        "The lowest-address byte contributes the least-significant eight bits.",
        [
            "The lowest-address byte is always the sign byte.",
            "Byte order reverses bits within each byte.",
            "The highest-address byte is always ignored.",
        ],
        "Reconstructing a value shifts each successive byte by another eight bits in little-endian order.",
        "bytes 78 56 34 12 → 0x12345678",
    ),
)

SQL_FUNDAMENTALS = (
    fact(
        "relational-model",
        "the relational model",
        "A relation is conceptually a set of tuples described by attributes and constraints.",
        [
            "Rows have an inherent permanent order.",
            "Every table must contain duplicate rows.",
            "Columns may hold arbitrary unrelated types per row.",
        ],
        "SQL tables approximate relations while adding practical features such as bags, nulls, and implementation-specific storage.",
        "relation(attributes)",
    ),
    fact(
        "primary-key",
        "primary keys",
        "A primary key uniquely identifies each row and its columns are not null.",
        [
            "A table may declare several primary keys.",
            "Primary keys permit duplicate null values.",
            "A primary key must be one integer column.",
        ],
        "A primary key may be composite; a table has one primary-key constraint even when it spans columns.",
        "PRIMARY KEY (account_id, date)",
    ),
    fact(
        "foreign-key",
        "foreign keys",
        "They require child values to match a referenced candidate key unless the child value is allowed to be null.",
        [
            "They automatically copy every parent row.",
            "They require both tables to be the same table.",
            "They guarantee unique child values.",
        ],
        "Foreign keys enforce referential integrity, with configured actions for parent updates or deletes.",
        "FOREIGN KEY (customer_id) REFERENCES customers(id)",
    ),
    fact(
        "candidate-key",
        "candidate keys",
        "A candidate key is a minimal attribute set that uniquely identifies a row.",
        [
            "It must be selected as the primary key.",
            "It may contain redundant identifying columns.",
            "It is the same as every nonunique index.",
        ],
        "One candidate is chosen as primary while others may be enforced with unique constraints.",
        "UNIQUE (email)",
    ),
    fact(
        "normalization",
        "database normalization",
        "It decomposes data to reduce redundancy and update anomalies while preserving needed relationships.",
        [
            "It always makes every query faster.",
            "It means storing all data in one table.",
            "It removes every foreign key.",
        ],
        "Normal forms express dependency rules; deliberate denormalization may later trade consistency complexity for read performance.",
        "orders and order_items",
    ),
    fact(
        "first-normal-form",
        "first normal form",
        "Each row-column intersection holds one value from the column's domain rather than a repeating group.",
        [
            "Every table must have one row.",
            "All columns must contain the same type.",
            "Transitive dependencies are required.",
        ],
        "1NF establishes a tabular shape with atomic values relative to the chosen domain.",
        "one phone number per related row",
    ),
    fact(
        "third-normal-form",
        "third normal form",
        "Non-key attributes should not depend transitively on a key through another non-key attribute.",
        [
            "Every table must have exactly three columns.",
            "Partial key dependencies are required.",
            "It forbids all foreign keys.",
        ],
        "3NF reduces facts about independent entities being repeated in rows identified by another entity's key.",
        "customer details separated from orders",
    ),
    fact(
        "null",
        "SQL NULL",
        "NULL represents missing or unknown information and is tested with IS NULL, not = NULL.",
        [
            "NULL equals NULL in ordinary comparison.",
            "NULL is the same as numeric zero.",
            "NOT NULL removes the column.",
        ],
        "Most comparisons involving NULL yield UNKNOWN under SQL's three-valued logic.",
        "value IS NULL",
    ),
    fact(
        "three-valued",
        "SQL three-valued logic",
        "Predicates may be TRUE, FALSE, or UNKNOWN, and WHERE keeps only TRUE rows.",
        [
            "UNKNOWN is treated as TRUE by WHERE.",
            "NULL comparisons always return FALSE.",
            "Boolean logic has only two values in SQL.",
        ],
        "NULL-sensitive expressions propagate UNKNOWN according to truth tables, which affects filters and constraints.",
        "price > 10 with price NULL → UNKNOWN",
    ),
    fact(
        "transactions",
        "transactions",
        "They group operations into a unit that commits together or rolls back.",
        [
            "Each statement is visible permanently before commit in every system.",
            "Rollback repeats the transaction.",
            "Transactions can contain only reads.",
        ],
        "Transaction boundaries let applications preserve invariants across multiple statements.",
        "BEGIN; ... COMMIT;",
    ),
    fact(
        "atomicity",
        "transaction atomicity",
        "Either all transaction effects commit or none of them do.",
        [
            "It guarantees every query is fast.",
            "It means values are indivisible data types.",
            "It prevents all concurrent reads.",
        ],
        "Atomicity protects against partial application of a logical operation after failures or explicit rollback.",
        "debit and credit together",
    ),
    fact(
        "isolation",
        "transaction isolation",
        "It controls which effects concurrent transactions may observe and which anomalies are prevented.",
        [
            "It encrypts rows on disk.",
            "It means every database runs on one thread.",
            "It replaces atomicity.",
        ],
        "Higher isolation can provide stronger behavior at a concurrency cost, with exact semantics varying by database.",
        "read committed / serializable",
    ),
    fact(
        "mvcc",
        "multi-version concurrency control",
        "It retains row versions so readers can use a consistent snapshot without blocking every writer.",
        [
            "It stores only the newest value.",
            "It removes the need for cleanup.",
            "It guarantees serializable behavior in every mode.",
        ],
        "MVCC uses transaction visibility rules and eventually reclaims obsolete versions.",
        "snapshot visibility",
    ),
    fact(
        "btree-index",
        "B-tree indexes",
        "They support ordered lookup, range scans, and prefix use of composite keys.",
        [
            "They are useful only for exact equality.",
            "They store rows in random hash buckets only.",
            "They make every write cheaper.",
        ],
        "Balanced tree structure keeps lookup depth small and maintains key order, at the cost of write maintenance.",
        "INDEX ON trades(symbol, time)",
    ),
    fact(
        "hash-index",
        "hash indexes",
        "They are primarily suited to equality lookup and generally do not provide ordered range scans.",
        [
            "They always support ORDER BY without sorting.",
            "They store keys in sorted leaf pages.",
            "They replace uniqueness constraints automatically.",
        ],
        "Hashing maps equal keys to buckets but discards the key ordering needed for range predicates.",
        "WHERE id = ?",
    ),
    fact(
        "composite-index",
        "composite-index column order",
        "The leading columns determine which predicate prefixes can efficiently navigate a typical B-tree.",
        [
            "Column order never matters.",
            "Only the final column can be searched.",
            "Every permutation is stored automatically.",
        ],
        "An index on (a,b) commonly supports a and a+b predicates better than b alone.",
        "INDEX (symbol, trade_time)",
    ),
    fact(
        "unique-constraint",
        "UNIQUE constraints",
        "They require distinct non-null key combinations, with NULL treatment depending on the database.",
        [
            "They are comments with no enforcement.",
            "They always make the column a primary key.",
            "They permit duplicate non-null values.",
        ],
        "A unique constraint expresses data integrity and is commonly backed by a unique index.",
        "UNIQUE (venue, external_id)",
    ),
    fact(
        "check-constraint",
        "CHECK constraints",
        "They require inserted or updated rows to satisfy a predicate under the database's constraint semantics.",
        [
            "They run only during SELECT.",
            "They can validate arbitrary rows in other tables portably.",
            "They silently repair invalid data.",
        ],
        "CHECK keeps domain rules close to stored data, such as positive quantity or bounded status values.",
        "CHECK (quantity > 0)",
    ),
    fact(
        "view",
        "database views",
        "A regular view stores a query definition and presents its result like a table.",
        [
            "It always stores a separate copy of every result row.",
            "It cannot reference joins.",
            "It automatically indexes every expression.",
        ],
        "A materialized view stores results; an ordinary view usually computes them from base data when queried.",
        "CREATE VIEW active_orders AS ...",
    ),
    fact(
        "execution-plan",
        "query execution plans",
        "They describe physical operators and access paths chosen to execute a query.",
        [
            "They are the SQL query's final result rows.",
            "They never depend on statistics.",
            "They are fixed forever after table creation.",
        ],
        "Optimizers compare possible plans using cardinality and cost estimates; EXPLAIN exposes the selected plan.",
        "EXPLAIN SELECT ...",
    ),
)

SQL_APPLIED = (
    fact(
        "where-having",
        "WHERE versus HAVING",
        "WHERE filters rows before grouping; HAVING filters groups after aggregation.",
        [
            "HAVING always runs before WHERE.",
            "WHERE may freely reference aggregate results from the same level.",
            "They are exact synonyms.",
        ],
        "Placing row predicates in WHERE can reduce data before GROUP BY, while aggregate predicates belong in HAVING.",
        "GROUP BY desk HAVING SUM(pnl) > 0",
    ),
    fact(
        "inner-left-join",
        "INNER JOIN versus LEFT JOIN",
        "INNER JOIN keeps matches; LEFT JOIN also retains unmatched left rows with null right columns.",
        [
            "LEFT JOIN keeps only unmatched rows.",
            "INNER JOIN creates every possible pair.",
            "Both always return identical rows.",
        ],
        "Outer joins preserve a designated side, which matters when missing relationships should remain visible.",
        "accounts LEFT JOIN trades ON ...",
    ),
    fact(
        "join-filter",
        "filters on an outer-joined table",
        "A right-table predicate in WHERE can remove null-extended rows and effectively turn a LEFT JOIN into an inner filter.",
        [
            "WHERE never affects join preservation.",
            "ON and WHERE are always interchangeable.",
            "The predicate creates extra unmatched rows.",
        ],
        "Put relationship restrictions in ON when unmatched left rows should still survive.",
        "LEFT JOIN b ON a.id=b.id AND b.active",
    ),
    fact(
        "group-by",
        "GROUP BY",
        "It forms groups of rows sharing grouping expressions so aggregates can return one result per group.",
        [
            "It sorts output by definition in every database.",
            "It can be used only with COUNT.",
            "It removes the need to aggregate selected non-key columns.",
        ],
        "Selected expressions generally must be grouped, aggregated, or functionally dependent according to the database's rules.",
        "SELECT symbol, SUM(quantity) ... GROUP BY symbol",
    ),
    fact(
        "count-null",
        "COUNT(*) versus COUNT(column)",
        "COUNT(*) counts rows, while COUNT(column) ignores rows where that expression is NULL.",
        [
            "Both ignore every NULL anywhere in the row.",
            "COUNT(*) counts columns rather than rows.",
            "COUNT(column) counts only distinct values.",
        ],
        "Use COUNT(DISTINCT column) for distinct non-null values; ordinary COUNT(column) includes duplicates.",
        "COUNT(*), COUNT(cancelled_at)",
    ),
    fact(
        "distinct",
        "SELECT DISTINCT",
        "It removes duplicate result rows based on all selected expressions.",
        [
            "It changes duplicate rows in the base table.",
            "It applies only to the first selected column.",
            "It guarantees a sorted output.",
        ],
        "DISTINCT is a result-set operation and does not imply persistent uniqueness or ordering.",
        "SELECT DISTINCT venue, symbol",
    ),
    fact(
        "window",
        "window functions",
        "They compute across related rows while retaining one output row per input row.",
        [
            "They always collapse groups to one row.",
            "They may appear directly in WHERE in portable SQL.",
            "They require recursive CTEs.",
        ],
        "The OVER clause defines partitioning and ordering separately from GROUP BY aggregation.",
        "SUM(pnl) OVER (PARTITION BY desk)",
    ),
    fact(
        "row-number",
        "ROW_NUMBER()",
        "It assigns sequential numbers within each window partition according to the window order.",
        [
            "Tied values always receive the same number.",
            "It counts only non-null rows.",
            "It may omit ORDER BY while still guaranteeing a stable business order.",
        ],
        "ROW_NUMBER differs from RANK and DENSE_RANK because every row gets a distinct sequence number.",
        "ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY time DESC)",
    ),
    fact(
        "rank",
        "RANK() versus DENSE_RANK()",
        "Both share ranks for ties, but RANK leaves gaps after ties while DENSE_RANK does not.",
        [
            "DENSE_RANK gives every row a unique value.",
            "RANK never leaves gaps.",
            "They ignore the window ORDER BY.",
        ],
        "Choose based on whether tied positions should consume subsequent ranking numbers.",
        "RANK() OVER (ORDER BY score DESC)",
    ),
    fact(
        "window-frame",
        "window frames",
        "ROWS BETWEEN controls which ordered rows contribute to a window aggregate around the current row.",
        [
            "It filters rows out of the final result.",
            "It changes table storage order.",
            "It is identical to PARTITION BY.",
        ],
        "A running total commonly uses an unbounded-preceding through current-row frame.",
        "ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW",
    ),
    fact(
        "cte",
        "common table expressions",
        "A WITH clause names a query result for use by the following statement.",
        [
            "It always materializes to disk.",
            "It creates a permanent table.",
            "It can be referenced by future unrelated sessions.",
        ],
        "CTE optimization and materialization vary by database; semantically it scopes a named query to one statement.",
        "WITH totals AS (...) SELECT ... FROM totals",
    ),
    fact(
        "recursive-cte",
        "recursive CTEs",
        "They combine an anchor query with a recursive term that references the CTE until no new rows are produced.",
        [
            "They require a stored procedure loop.",
            "They may not have an anchor term.",
            "They always run forever.",
        ],
        "Recursive CTEs express hierarchies, graph reachability, and generated sequences with database-specific safeguards.",
        "WITH RECURSIVE tree AS (anchor UNION ALL recursive_term)",
    ),
    fact(
        "exists",
        "EXISTS",
        "It tests whether a subquery produces at least one row and can stop after finding one.",
        [
            "It returns the subquery's first column value.",
            "It requires the subquery to return COUNT(*).",
            "It is true only for exactly one row.",
        ],
        "EXISTS expresses semi-join logic and is unaffected by which constant or column the subquery selects.",
        "WHERE EXISTS (SELECT 1 FROM fills f WHERE f.order_id=o.id)",
    ),
    fact(
        "not-in-null",
        "NOT IN with NULL",
        "A NULL in the candidate set can make comparisons UNKNOWN and prevent expected matches.",
        [
            "NULL is silently removed from every IN list.",
            "NOT IN is always identical to NOT EXISTS.",
            "UNKNOWN rows pass WHERE.",
        ],
        "A correlated NOT EXISTS is often safer for anti-joins when nullable values may appear.",
        "WHERE NOT EXISTS (...)",
    ),
    fact(
        "union",
        "UNION versus UNION ALL",
        "UNION removes duplicate rows; UNION ALL concatenates results without duplicate elimination.",
        [
            "UNION ALL sorts and deduplicates.",
            "UNION changes source tables.",
            "Both require identical column names and types in every database.",
        ],
        "Compatible column counts and types are needed; avoiding deduplication usually makes UNION ALL cheaper.",
        "query_a UNION ALL query_b",
    ),
    fact(
        "case",
        "CASE expressions",
        "They return the result for the first matching WHEN branch, or ELSE/NULL when none matches.",
        [
            "Every matching branch is concatenated.",
            "CASE can appear only in SELECT.",
            "ELSE is mandatory.",
        ],
        "CASE is an expression usable in projections, ordering, aggregates, and other expression contexts.",
        "CASE WHEN side='B' THEN quantity ELSE -quantity END",
    ),
    fact(
        "coalesce",
        "COALESCE",
        "It returns the first non-null argument, or NULL if all arguments are NULL.",
        [
            "It returns the first argument even when NULL.",
            "It converts every argument to text.",
            "It is an aggregate function over rows.",
        ],
        "COALESCE is useful for fallback values, subject to the database's type-resolution rules.",
        "COALESCE(cancelled_at, completed_at, created_at)",
    ),
    fact(
        "upsert",
        "upsert operations",
        "They attempt an insert and apply specified conflict behavior such as update or ignore.",
        [
            "They always delete the conflicting row first.",
            "They bypass every uniqueness rule.",
            "They are spelled identically in every database.",
        ],
        "PostgreSQL uses ON CONFLICT, while other systems expose different merge or duplicate-key syntax.",
        "INSERT ... ON CONFLICT (id) DO UPDATE ...",
    ),
    fact(
        "parameterized",
        "parameterized SQL",
        "It sends data values separately from SQL syntax, reducing injection risk and handling quoting.",
        [
            "It allows untrusted input to choose arbitrary identifiers safely.",
            "It is equivalent to concatenating escaped-looking strings.",
            "It disables query planning.",
        ],
        "Values should use driver placeholders; dynamic identifiers require controlled allowlists or database-specific composition APIs.",
        "cursor.execute('... WHERE id = %s', (value,))",
    ),
    fact(
        "sargable",
        "sargable predicates",
        "They let an optimizer use an index search range instead of computing a function for every indexed value.",
        [
            "They require wrapping every indexed column in a function.",
            "They prevent all index use.",
            "They apply only to INSERT.",
        ],
        "Rewriting a date extraction as a half-open range is a common way to preserve index navigation.",
        "created_at >= start AND created_at < end",
    ),
)


TRACKS = {
    "python-libraries": (PYTHON_LIBRARY_FUNDAMENTALS, PYTHON_LIBRARY_CALLS),
    "computer-architecture": (ARCHITECTURE_FUNDAMENTALS, ARCHITECTURE_APPLIED),
    "sql": (SQL_FUNDAMENTALS, SQL_APPLIED),
}


def build_questions(track, topic, facts):
    questions = []
    for identifier, label, correct, wrong, explanation, code in facts:
        if len(wrong) != 3 or len({correct, *wrong}) != 4:
            raise AssertionError(f"Invalid choices for {track}:{identifier}")
        for variant, template in enumerate(PROMPTS):
            answer = variant % 4
            choices = list(wrong)
            choices.insert(answer, correct)
            questions.append(
                {
                    "id": f"{track}-{topic}-{identifier}-{variant + 1}",
                    "concept": f"{track}-{topic}-{identifier}",
                    "topic": topic,
                    "prompt": template.format(label=label),
                    "code": code or None,
                    "choices": choices,
                    "answer": answer,
                    "explanation": explanation,
                }
            )
    return questions


def main():
    payload = {}
    for track, (fundamentals, applied) in TRACKS.items():
        if len(fundamentals) != 20 or len(applied) != 20:
            raise AssertionError(
                f"{track} needs 20 concepts per topic, got {len(fundamentals)} and {len(applied)}"
            )
        questions = [
            *build_questions(track, "fundamentals", fundamentals),
            *build_questions(track, "function-calls", applied),
        ]
        if len(questions) != 200:
            raise AssertionError(f"{track} generated {len(questions)} questions")
        payload[track] = questions
    OUTPUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print("Generated 600 extended trivia questions across three tracks.")


if __name__ == "__main__":
    main()
