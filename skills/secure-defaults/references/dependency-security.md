# Dependency Security

> Reference for: secure-defaults
> Load when: Auditing packages, pinning versions, reviewing supply chain risk

## Why Dependencies Are a Risk

A vulnerability in any direct or transitive dependency is a vulnerability in your application.
Supply chain attacks (malicious packages published to npm/PyPI) have increased significantly
since 2020. Defense requires: audit, pin, minimize, monitor.

---

## Audit Commands

Run these before every release and in CI:

```bash
# Node.js / npm
npm audit
npm audit --audit-level=high   # fail CI only on high/critical

# Node.js / pnpm
pnpm audit

# Node.js / yarn
yarn npm audit

# Python
pip audit                       # requires pip-audit: pip install pip-audit
safety check                    # alternative: pip install safety

# Rust
cargo audit                     # requires: cargo install cargo-audit

# Go
govulncheck ./...               # requires: go install golang.org/x/vuln/cmd/govulncheck@latest
```

---

## Lockfiles — Always Commit Them

Lockfiles ensure everyone installs the exact same dependency tree:

| Package Manager | Lockfile |
|----------------|---------|
| npm | `package-lock.json` |
| pnpm | `pnpm-lock.yaml` |
| yarn | `yarn.lock` |
| pip | `requirements.txt` (pinned) or `poetry.lock` |
| cargo | `Cargo.lock` |
| go | `go.sum` |

**Never add lockfiles to `.gitignore`.** If you see `package-lock.json` in `.gitignore`, remove it.

---

## Version Pinning Strategy

| Dependency type | Strategy |
|----------------|---------|
| Production | Pin to exact version in lockfile; allow semver ranges in `package.json` |
| Dev / CI tools | Exact version or tight range to prevent surprise breakage |
| Security-critical | Always exact version (auth libraries, crypto, parsers) |

```json
// package.json — use semver ranges for convenience
{
  "dependencies": {
    "express": "^4.18.2",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "typescript": "~5.4.5"
  }
}
```

The lockfile guarantees the exact tree. The range allows controlled upgrades.

---

## Evaluating a New Dependency

Before adding any package, ask:

| Question | Red flag |
|----------|---------|
| How many downloads per week? | < 1,000 / week for a "utility" package |
| When was it last published? | > 2 years without activity |
| How many maintainers? | 1 maintainer with no recent activity |
| Does it match the scope I need? | Pulling 50 transitive deps for a small utility |
| Is there a native or built-in alternative? | Always prefer `node:crypto` over a random crypto npm package |

**Prefer packages that:**
- Are maintained by large organizations or have many maintainers.
- Have a security policy and disclose vulnerabilities.
- Ship TypeScript types natively or via `@types/`.
- Have minimal transitive dependencies.

---

## Automated Monitoring

Set up automated dependency scanning in CI:

```yaml
# GitHub Actions — Dependabot (add .github/dependabot.yml)
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

For npm, also enable GitHub's dependency graph and security advisories in repository settings.

---

## Responding to a Vulnerable Dependency

1. Check if your code actually calls the vulnerable code path.
2. If yes: update immediately. If update breaks API, check if a patch version exists.
3. If no update available: assess exploitability and apply a workaround (input filter, feature disable).
4. Document the decision and set a reminder to re-check in 2 weeks.
5. If critical and no fix: consider replacing the dependency.

```bash
# Update a specific package to fix a vulnerability
npm install package-name@latest

# Check the audit status after updating
npm audit
```
