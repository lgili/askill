# C++ Advanced Patterns

## Table of Contents

1. Template Metaprogramming
2. Testing with Google Test
3. Catch2 Testing Framework
4. Advanced Concurrency
5. Memory Management Patterns
6. Production Patterns
7. Build System Patterns
8. Performance Optimization

## Template Metaprogramming

Use templates to encode constraints and invariants while keeping diagnostics readable.

Variadic Templates:

```cpp
#include <iostream>
#include <utility>

template <typename... Args>
auto sum(Args... args) {
    return (args + ...);  // Fold expression
}

template <typename... Args>
auto print_all(Args&&... args) -> void {
    ((std::cout << std::forward<Args>(args) << " "), ...);
}
```

SFINAE and `if constexpr`:

```cpp
#include <string>
#include <type_traits>

template <typename T>
auto to_string(const T& value) -> std::string {
    if constexpr (std::is_arithmetic_v<T>) {
        return std::to_string(value);
    } else if constexpr (requires { value.to_string(); }) {
        return value.to_string();
    } else {
        return "unknown";
    }
}
```

## Testing with Google Test

Complete test suite:

```cpp
#include <gtest/gtest.h>
#include <stdexcept>
#include <tuple>

class Calculator {
public:
    auto add(int a, int b) const -> int { return a + b; }
    auto divide(int a, int b) const -> int {
        if (b == 0) {
            throw std::invalid_argument("division by zero");
        }
        return a / b;
    }
};

class CalculatorTest : public ::testing::Test {
protected:
    Calculator calc;

    auto SetUp() -> void override { calc = Calculator{}; }
};

TEST_F(CalculatorTest, Addition) {
    EXPECT_EQ(calc.add(2, 3), 5);
}

TEST_F(CalculatorTest, DivisionByZero) {
    EXPECT_THROW(calc.divide(1, 0), std::invalid_argument);
}

class AdditionTest : public ::testing::TestWithParam<std::tuple<int, int, int>> {};

TEST_P(AdditionTest, Works) {
    auto [a, b, expected] = GetParam();
    EXPECT_EQ(Calculator{}.add(a, b), expected);
}

INSTANTIATE_TEST_SUITE_P(
    Basics, AdditionTest,
    ::testing::Values(
        std::make_tuple(1, 1, 2),
        std::make_tuple(0, 0, 0),
        std::make_tuple(-1, 1, 0)));
```

## Catch2 Testing Framework

Alternative testing style:

```cpp
#include <catch2/catch_test_macros.hpp>
#include <catch2/generators/catch_generators.hpp>
#include <vector>

TEST_CASE("Vector operations", "[vector]") {
    std::vector<int> v;

    SECTION("starts empty") {
        REQUIRE(v.empty());
    }

    SECTION("can add elements") {
        v.push_back(1);
        REQUIRE(v.size() == 1);
        REQUIRE(v[0] == 1);
    }

    SECTION("can be resized") {
        v.resize(10);
        REQUIRE(v.size() == 10);
    }
}

TEST_CASE("Generators", "[generator]") {
    auto i = GENERATE(range(1, 10));
    REQUIRE(i > 0);
    REQUIRE(i < 10);
}
```

## Advanced Concurrency

Prefer cancellation-aware and ownership-safe concurrency primitives first. Use advanced
lock-free structures only when profiling shows locks as a bottleneck.

Thread pool implementation:

```cpp
#include <condition_variable>
#include <functional>
#include <future>
#include <mutex>
#include <queue>
#include <thread>
#include <type_traits>
#include <utility>
#include <vector>

class ThreadPool {
public:
    explicit ThreadPool(std::size_t num_threads) : stop_(false) {
        for (std::size_t i = 0; i < num_threads; ++i) {
            workers_.emplace_back([this] {
                while (true) {
                    std::function<void()> task;
                    {
                        std::unique_lock<std::mutex> lock(mutex_);
                        cv_.wait(lock, [this] { return stop_ || !tasks_.empty(); });
                        if (stop_ && tasks_.empty()) {
                            return;
                        }
                        task = std::move(tasks_.front());
                        tasks_.pop();
                    }
                    task();
                }
            });
        }
    }

    template <typename F, typename... Args>
    auto enqueue(F&& f, Args&&... args) -> std::future<std::invoke_result_t<F, Args...>> {
        using return_type = std::invoke_result_t<F, Args...>;

        auto task = std::make_shared<std::packaged_task<return_type()>>(
            std::bind(std::forward<F>(f), std::forward<Args>(args)...));

        auto result = task->get_future();
        {
            std::unique_lock<std::mutex> lock(mutex_);
            tasks_.emplace([task] { (*task)(); });
        }
        cv_.notify_one();
        return result;
    }

    ~ThreadPool() {
        {
            std::unique_lock<std::mutex> lock(mutex_);
            stop_ = true;
        }
        cv_.notify_all();
        for (auto& worker : workers_) {
            if (worker.joinable()) {
                worker.join();
            }
        }
    }

private:
    std::vector<std::thread> workers_;
    std::queue<std::function<void()>> tasks_;
    std::mutex mutex_;
    std::condition_variable cv_;
    bool stop_;
};
```

Lock-free queue (educational sample):

```cpp
#include <atomic>
#include <optional>
#include <utility>

template <typename T>
class LockFreeQueue {
    struct Node {
        std::optional<T> data;
        std::atomic<Node*> next;

        Node() : data(std::nullopt), next(nullptr) {}
        explicit Node(T value) : data(std::move(value)), next(nullptr) {}
    };

    std::atomic<Node*> head_;
    std::atomic<Node*> tail_;

public:
    LockFreeQueue() {
        auto* dummy = new Node();
        head_.store(dummy, std::memory_order_relaxed);
        tail_.store(dummy, std::memory_order_relaxed);
    }

    ~LockFreeQueue() {
        while (pop().has_value()) {
        }
        delete head_.load(std::memory_order_relaxed);
    }

    auto push(T value) -> void {
        auto* new_node = new Node(std::move(value));
        while (true) {
            Node* old_tail = tail_.load(std::memory_order_acquire);
            Node* tail_next = old_tail->next.load(std::memory_order_acquire);

            if (old_tail == tail_.load(std::memory_order_acquire)) {
                if (tail_next == nullptr) {
                    if (old_tail->next.compare_exchange_weak(
                            tail_next, new_node, std::memory_order_release,
                            std::memory_order_relaxed)) {
                        tail_.compare_exchange_weak(
                            old_tail, new_node, std::memory_order_release,
                            std::memory_order_relaxed);
                        return;
                    }
                } else {
                    tail_.compare_exchange_weak(
                        old_tail, tail_next, std::memory_order_release,
                        std::memory_order_relaxed);
                }
            }
        }
    }

    auto pop() -> std::optional<T> {
        while (true) {
            Node* old_head = head_.load(std::memory_order_acquire);
            Node* old_tail = tail_.load(std::memory_order_acquire);
            Node* next = old_head->next.load(std::memory_order_acquire);

            if (old_head == head_.load(std::memory_order_acquire)) {
                if (old_head == old_tail) {
                    if (next == nullptr) {
                        return std::nullopt;
                    }
                    tail_.compare_exchange_weak(
                        old_tail, next, std::memory_order_release,
                        std::memory_order_relaxed);
                } else {
                    auto result = std::move(next->data);
                    if (head_.compare_exchange_weak(
                            old_head, next, std::memory_order_release,
                            std::memory_order_relaxed)) {
                        delete old_head;
                        return result;
                    }
                }
            }
        }
    }
};
```

Note: for production lock-free queues, use proven implementations with robust memory
reclamation (hazard pointers, epoch reclamation, or equivalent).

## Memory Management Patterns

Custom allocator:

```cpp
#include <algorithm>
#include <cstddef>
#include <memory>
#include <new>
#include <vector>

template <typename T>
class PoolAllocator {
    struct Block {
        Block* next;
    };

    Block* free_list_ = nullptr;
    std::vector<std::unique_ptr<std::byte[]>> pools_;
    std::size_t block_size_ = std::max(sizeof(T), sizeof(Block));
    std::size_t pool_size_ = 1024;

public:
    using value_type = T;

    auto allocate(std::size_t n) -> T* {
        if (n != 1) {
            throw std::bad_alloc();
        }
        if (!free_list_) {
            allocate_pool();
        }
        Block* block = free_list_;
        free_list_ = block->next;
        return reinterpret_cast<T*>(block);
    }

    auto deallocate(T* p, std::size_t) -> void {
        Block* block = reinterpret_cast<Block*>(p);
        block->next = free_list_;
        free_list_ = block;
    }

private:
    auto allocate_pool() -> void {
        auto pool = std::make_unique<std::byte[]>(block_size_ * pool_size_);
        for (std::size_t i = 0; i < pool_size_; ++i) {
            Block* block = reinterpret_cast<Block*>(pool.get() + i * block_size_);
            block->next = free_list_;
            free_list_ = block;
        }
        pools_.push_back(std::move(pool));
    }
};
```

## Production Patterns

Dependency injection:

```cpp
#include <format>
#include <memory>
#include <print>
#include <string_view>
#include <utility>

class ILogger {
public:
    virtual ~ILogger() = default;
    virtual auto log(std::string_view message) -> void = 0;
};

class ConsoleLogger : public ILogger {
public:
    auto log(std::string_view message) -> void override {
        std::println("{}", message);
    }
};

class UserService {
    std::shared_ptr<ILogger> logger_;

public:
    explicit UserService(std::shared_ptr<ILogger> logger) : logger_(std::move(logger)) {}

    auto create_user(std::string_view name) -> void {
        logger_->log(std::format("Creating user: {}", name));
        // Business logic
    }
};

class ServiceFactory {
public:
    static auto create_user_service() -> std::unique_ptr<UserService> {
        return std::make_unique<UserService>(std::make_shared<ConsoleLogger>());
    }
};
```

## Build System Patterns

Conan 2.0 integration:

```python
# conanfile.py
from conan import ConanFile
from conan.tools.cmake import CMake, cmake_layout


class MyProjectConan(ConanFile):
    name = "myproject"
    version = "1.0.0"
    settings = "os", "compiler", "build_type", "arch"
    generators = "CMakeToolchain", "CMakeDeps"
    requires = "fmt/10.2.1", "nlohmann_json/3.11.3"
    tool_requires = "gtest/1.14.0"

    def layout(self):
        cmake_layout(self)

    def build(self):
        cmake = CMake(self)
        cmake.configure()
        cmake.build()
```

vcpkg manifest:

```json
{
    "$schema": "https://raw.githubusercontent.com/microsoft/vcpkg-tool/main/docs/vcpkg.schema.json",
    "name": "myproject",
    "version": "1.0.0",
    "dependencies": [
        "fmt",
        "nlohmann-json",
        "spdlog",
        { "name": "gtest", "features": [ "gmock" ] }
    ]
}
```

## Performance Optimization

Cache-friendly data structure (SoA):

```cpp
#include <cstddef>
#include <vector>

struct Particles {
    std::vector<float> x;
    std::vector<float> y;
    std::vector<float> z;
    std::vector<float> vx;
    std::vector<float> vy;
    std::vector<float> vz;

    auto update(float dt) -> void {
        for (std::size_t i = 0; i < x.size(); ++i) {
            x[i] += vx[i] * dt;
        }
        for (std::size_t i = 0; i < y.size(); ++i) {
            y[i] += vy[i] * dt;
        }
        for (std::size_t i = 0; i < z.size(); ++i) {
            z[i] += vz[i] * dt;
        }
    }
};
```

SIMD optimization:

```cpp
#include <cstddef>
#include <immintrin.h>

auto add_vectors_simd(const float* a, const float* b, float* result, std::size_t n) -> void {
    std::size_t i = 0;
    for (; i + 7 < n; i += 8) {
        __m256 va = _mm256_loadu_ps(a + i);
        __m256 vb = _mm256_loadu_ps(b + i);
        __m256 vr = _mm256_add_ps(va, vb);
        _mm256_storeu_ps(result + i, vr);
    }
    for (; i < n; ++i) {
        result[i] = a[i] + b[i];
    }
}
```
