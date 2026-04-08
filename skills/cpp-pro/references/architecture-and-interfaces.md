# Architecture and Interfaces

> Reference for: cpp-pro
> Load when: header design, ownership contracts, ABI boundaries, library layout, service structure

## Default Design Priorities

1. Stable interfaces before clever implementations.
2. Ownership and lifetime must be obvious from the type system.
3. Keep recompilation cost under control by minimizing public-header churn.
4. Separate domain logic from transport, process lifecycle, and platform glue.

## Header Hygiene

- Keep public headers self-contained and include only what they need.
- Prefer forward declarations in headers when they reduce dependency fan-out safely.
- Avoid inline implementation in public headers unless the code is trivial or intentionally header-only.
- Do not expose heavy third-party headers in public APIs unless the dependency is part of the contract.

Example:

```cpp
#pragma once

#include <memory>
#include <string>
#include <string_view>

namespace telemetry {

class Sink;

class Client {
public:
    explicit Client(std::shared_ptr<Sink> sink);

    auto send(std::string_view payload) -> void;
    [[nodiscard]] auto endpoint() const -> const std::string&;

private:
    std::shared_ptr<Sink> sink_;
    std::string endpoint_;
};

}  // namespace telemetry
```

## Ownership Contracts

Use interfaces to communicate lifetime rules directly:

- `T` or `std::vector<T>`: transfer or copy by value.
- `T&` or `const T&`: borrowed object that must outlive the call.
- `std::unique_ptr<T>`: ownership transfer.
- `std::shared_ptr<T>`: shared lifetime only when there is real multi-owner need.
- `std::span<T>` / `std::string_view`: non-owning sequence views.

Prefer this:

```cpp
auto parse_records(std::span<const std::byte> bytes) -> ParseResult;
auto attach_logger(std::shared_ptr<Logger> logger) -> void;
```

Over this:

```cpp
auto parse_records(const std::vector<std::byte>& bytes) -> ParseResult;
auto attach_logger(Logger* logger) -> void;
```

## Error Modeling

Pick one dominant model per subsystem:

- Exceptions for invariant violations and deeply nested failure propagation.
- Status objects or `std::expected` style returns for predictable operational failures.
- Assertions for programmer mistakes and impossible states, not user-facing error handling.

Make the choice explicit in APIs:

```cpp
enum class ParseError {
    invalid_magic,
    truncated_payload,
};

auto parse_header(std::span<const std::byte> bytes)
    -> std::expected<Header, ParseError>;
```

## ABI-Sensitive Boundaries

When a library may be distributed independently, public ABI matters:

- Avoid exposing STL-heavy or templated implementation details unless they are intentional API.
- Use pimpl for unstable internals or heavy dependency boundaries.
- Prefer semantic versioning with compatibility notes when changing public types.
- Treat inline functions in installed headers as ABI/API surface.

Minimal pimpl pattern:

```cpp
class Engine {
public:
    Engine();
    ~Engine();

    Engine(Engine&&) noexcept;
    auto operator=(Engine&&) noexcept -> Engine&;

    Engine(const Engine&) = delete;
    auto operator=(const Engine&) -> Engine& = delete;

    auto tick() -> void;

private:
    class Impl;
    std::unique_ptr<Impl> impl_;
};
```

## Library Layout

For non-trivial repos, prefer:

```text
include/project_name/
src/
tests/
apps/
benchmarks/
cmake/
```

Guidelines:

- `include/`: public headers only.
- `src/`: implementation and private headers if needed.
- `apps/`: executables or service entrypoints.
- `tests/`: behavior and regression coverage.
- `benchmarks/`: reproducible performance checks.

## Service and CLI Structure

Keep process concerns at the edge:

- CLI argument parsing in `main.cpp` or a thin adapter layer.
- Service lifecycle, signals, and configuration loading near the process boundary.
- Business logic in reusable library targets, not buried in the executable target.

Example layering:

```text
apps/worker_main.cpp
src/worker_service.cpp
src/job_dispatcher.cpp
include/project/worker_service.hpp
include/project/job_dispatcher.hpp
```

## Review Checklist

- Are ownership and borrowing rules obvious from signatures?
- Are public headers small, stable, and dependency-light?
- Is the build target structure aligned with the runtime architecture?
- Are error contracts consistent inside the subsystem?
- Would this API still make sense six months from now under maintenance pressure?
