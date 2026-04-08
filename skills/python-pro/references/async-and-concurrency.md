# Async And Concurrency

## Decision Rules

- Use `asyncio` when the workload is mostly I/O-bound and the surrounding stack is already async-friendly.
- Use threads for blocking I/O when a full async migration is not justified.
- Use processes for CPU-bound work or isolation from the GIL.
- Do not mix multiple concurrency models in one subsystem without a clear boundary and ownership.

## Async Service Design

- Keep async at the outer boundary: transport layer, clients, repositories, or orchestrators.
- Avoid exposing sync wrappers around async internals unless the lifecycle is explicit.
- Reuse clients/sessions and close them deterministically.
- Treat cancellation as a normal control path, not an exceptional bug.

## Reliability Rules

- Set timeouts on network and queue operations.
- Use bounded concurrency (`Semaphore`, worker pools, batch limits).
- Design retried operations to be idempotent.
- Propagate correlation IDs and request/job metadata into logs.

## Testing Async Code

- Prefer `pytest.mark.asyncio` or the project standard plugin.
- Keep async tests deterministic; avoid raw `sleep()` for synchronization.
- Mock only external boundaries, not coroutine orchestration itself.
- Test cancellation, timeout, and retry branches intentionally.

## Performance Notes

- Avoid creating a new event loop, client session, or connection pool per request.
- Measure hot paths before introducing task batching or custom schedulers.
- Use backpressure-aware queueing for producer/consumer flows.

## Checklist

- Is async truly needed here?
- Are cancellation and timeout paths tested?
- Are shared clients reused safely?
- Is concurrency bounded?
- Are retries, idempotency, and logging consistent?

## Primary References

- [asyncio Documentation](https://docs.python.org/3/library/asyncio.html)
- [concurrent.futures Documentation](https://docs.python.org/3/library/concurrent.futures.html)
- [AnyIO Documentation](https://anyio.readthedocs.io/)
