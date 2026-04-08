# Secret Management

> Reference for: secure-defaults
> Load when: Handling API keys, passwords, tokens, connection strings, or environment variables

## The Rule

**Secrets never appear as string literals in source code — ever.**

Not in constants, not in config files committed to git, not in comments, not in test fixtures
using real credentials. If it is in the repository, assume it is public.

---

## Environment Variables

The standard pattern for secrets in any runtime:

```bash
# .env (never commit — add to .gitignore)
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
API_KEY=sk-live-abc123
JWT_SECRET=my-super-secret-key-at-least-32-chars

# .env.example (commit this — shows required vars with placeholders)
DATABASE_URL=postgresql://user:password@host:5432/dbname
API_KEY=your-api-key-here
JWT_SECRET=generate-with-openssl-rand-hex-32
```

### Reading in Node.js

```typescript
// Validate required secrets at startup — fail fast, fail loud
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

const config = {
  databaseUrl: requireEnv("DATABASE_URL"),
  apiKey:      requireEnv("API_KEY"),
  jwtSecret:   requireEnv("JWT_SECRET"),
};
```

### Reading in Python

```python
import os

def require_env(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {key}")
    return value

DATABASE_URL = require_env("DATABASE_URL")
API_KEY      = require_env("API_KEY")
```

---

## .gitignore Rules

Always include these in `.gitignore`:

```gitignore
# Secrets and credentials
.env
.env.local
.env.*.local
*.pem
*.key
*.p12
*.pfx
id_rsa
id_ed25519
credentials.json
service-account.json
secrets.yaml
secrets.json
```

---

## Secret Managers (production)

For production systems, environment variables in the process are good; a secret manager is better:

| Platform | Service |
|----------|---------|
| AWS | Secrets Manager / Parameter Store |
| GCP | Secret Manager |
| Azure | Key Vault |
| HashiCorp | Vault |
| GitHub Actions | Repository Secrets |
| Vercel / Netlify | Environment Variables UI |

Example — AWS Secrets Manager in Node.js:

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "us-east-1" });

async function getSecret(secretName: string): Promise<string> {
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretName }),
  );
  return response.SecretString ?? "";
}
```

---

## Token Hygiene

- **Rotate** secrets regularly; automate rotation where possible.
- **Scope** tokens to the minimum required permissions.
- **Expire** tokens — prefer short-lived tokens (15 min–1 hr) with refresh.
- **Revoke** immediately when a secret is exposed; don't wait to assess impact.
- **Audit** access logs for unexpected usage patterns.

---

## What to Do When a Secret is Exposed

1. **Revoke the secret immediately** — before investigating anything else.
2. Generate a new secret with a different value.
3. Check access logs for unauthorized use since the exposure.
4. Remove the secret from git history with `git filter-repo` or BFG Repo Cleaner.
5. Rotate any downstream credentials that the leaked secret could access.
6. Rotate all secrets in the same `.env` file (assume full compromise).
