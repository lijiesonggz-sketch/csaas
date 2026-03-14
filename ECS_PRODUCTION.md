# ECS Production Deployment

This setup exposes only `80` to the public internet.

- `nginx` is the public entrypoint.
- `backend`, `frontend`, `postgres`, and `redis` stay bound to `127.0.0.1` on the ECS host for local checks only.
- `443` is not enabled in this repository yet because it requires a domain name and a TLS certificate.

## 1. Prepare ECS

Run these commands on the ECS host:

```bash
cd /opt/csaas
cp .env.example .env
vi .env
chmod +x scripts/*.sh
```

Use values like this in `.env`:

```env
NEXT_PUBLIC_API_URL=http://8.163.22.120
NEXT_PUBLIC_WS_URL=http://8.163.22.120
NEXTAUTH_URL=http://8.163.22.120
FRONTEND_URL=http://8.163.22.120
CORS_ORIGIN=http://8.163.22.120
INTERNAL_API_URL=http://backend:3000
```

## 2. One-command deployment

```bash
cd /opt/csaas
./scripts/ecs-redeploy-all.sh /opt/csaas main
```

## 3. One-command checks

```bash
cd /opt/csaas
./scripts/ecs-check-services.sh /opt/csaas
```

The script verifies:

- container status and health for `postgres`, `redis`, `backend`, `frontend`, `nginx`
- local backend health at `127.0.0.1:3000`
- local frontend health at `127.0.0.1:3001`
- nginx gateway health at `127.0.0.1/nginx-health`
- public routing checks through nginx at `127.0.0.1/health` and `127.0.0.1/api/health`

## 4. Security group

Keep these inbound ports open only if you really need them:

- `80` for public HTTP access
- `22` for SSH

Close these public ports:

- `3000`
- `3001`
- `5432`
- `6379`

Even if they are still open in the security group by mistake, the containers are now bound to `127.0.0.1`, so they are not reachable from the public internet.

## 5. Useful manual checks

```bash
curl http://127.0.0.1/nginx-health
curl http://127.0.0.1/health
curl http://127.0.0.1/api/health
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3001/api/health
docker-compose ps
docker-compose logs --tail=100 nginx
docker-compose logs --tail=100 backend
docker-compose logs --tail=100 frontend
```

## 6. Frontend-only or backend-only updates

If you only changed one side:

```bash
./scripts/ecs-redeploy-backend.sh /opt/csaas main
./scripts/ecs-redeploy-frontend.sh /opt/csaas main
```

The frontend script also recreates `nginx`, because nginx is now the public entrypoint.
