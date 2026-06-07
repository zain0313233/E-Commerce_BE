# CommerceAI — Backend API

Express API for the CommerceAI marketplace. **Full documentation, env table, seed commands, and deploy guide live in the repo root:**

- [../README.md](../README.md)
- [../DEPLOY.md](../DEPLOY.md)

## Quick run

```bash
cp .env.example .env
npm install
npm run dev
```

Health check: `GET http://localhost:3001/api/health`

## Useful scripts

| Script | Command |
|--------|---------|
| Dev server | `npm run dev` |
| Seed catalog | `npm run seed:products` |
| Full seed | `npm run seed:products:full` |
| Fix images | `npm run images:fix-broken` |
| Create admin | `npm run create:admin` |

See root `README.md` for all environment variables.
