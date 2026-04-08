# Performance And Reliability

## Optimization Principles

- Measure before changing code.
- Fix highest-impact bottlenecks first.
- Prefer simpler, stable solutions over fragile micro-optimizations.

## Profiling Workflow

1. Define target metric (latency, throughput, memory, startup time).
2. Capture baseline under representative workload.
3. Profile hotspots (`cProfile`, `py-spy`, `scalene`, or framework-native tooling).
4. Optimize specific bottlenecks.
5. Re-measure and document impact.

## Common Performance Wins

- Reduce algorithmic complexity before tuning syntax.
- Move repeated I/O out of hot loops.
- Batch remote calls and database operations.
- Use generators/iterators for large streams.
- Reuse expensive clients/sessions with lifecycle control.

## Memory Practices

- Prefer streaming for large payloads.
- Keep object graphs small and short-lived when possible.
- Use `__slots__` only for proven high-volume object cases.
- Avoid unnecessary intermediate copies.

## Concurrency Choices

- Use `asyncio` for high-concurrency I/O when ecosystem supports async cleanly.
- Use threads for blocking I/O if async migration is not justified.
- Use processes for CPU-bound parallelism.
- Keep concurrency model consistent within a subsystem.

## Reliability Patterns

- Use retries with backoff and jitter for transient external failures.
- Use timeouts on all network and I/O boundaries.
- Design idempotent operations for retried workflows.
- Emit structured logs with correlation IDs.
- Add health checks and graceful degradation for critical services.

## Production Readiness Checklist

- Are SLO-relevant metrics instrumented?
- Are timeouts and retry budgets configured?
- Are failure modes explicit and observable?
- Are memory growth and resource leaks monitored?
- Is rollback strategy documented?

## Primary References

- [Python Profilers](https://docs.python.org/3/library/profile.html)
- [asyncio Documentation](https://docs.python.org/3/library/asyncio.html)
- [concurrent.futures Documentation](https://docs.python.org/3/library/concurrent.futures.html)
- [Logging Cookbook](https://docs.python.org/3/howto/logging-cookbook.html)
