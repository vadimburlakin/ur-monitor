# UR Property Monitor

Web app that monitors [UR](https://www.ur-net.go.jp/) rental properties for newly available rooms and notifies you via webhook.

## Features

- Simple login (just a user ID, no password)
- Browse available UR properties and pick which ones to watch
- Set a webhook URL to get notified when new rooms appear
- Configurable polling interval (1, 5, or 15 minutes)
- Live countdown to next poll with a "Poll Now" button
- Background polling per user

## How it works

1. Log in with any user ID (up to 16 characters). A new account is created if it doesn't exist.
2. Add property IDs to your watch list (or browse available properties from UR).
3. Set a webhook URL. When new rooms are found, the app POSTs a JSON payload to your webhook:
   ```json
   {
     "userId": "yourname",
     "totalNewRooms": 3,
     "changes": [
       { "propertyId": "12345", "previous": 0, "current": 3, "diff": 3 }
     ],
     "timestamp": "2026-03-13T10:00:00.000Z"
   }
   ```
4. Choose a polling interval. The app checks UR in the background and compares room counts with the previous poll.

## Running locally

### Prerequisites

- Node.js 20+
- PostgreSQL (or Docker to run it)

### Start PostgreSQL with Docker

```bash
docker run -d --name ur-postgres \
  -e POSTGRES_DB=urmonitor \
  -e POSTGRES_USER=urmonitor \
  -e POSTGRES_PASSWORD=urmonitor \
  -p 5432:5432 \
  postgres:16-alpine
```

### Install and run

```bash
npm install
node server.js
```

The app starts on [http://localhost:3000](http://localhost:3000).

Environment variables (all optional when using defaults above):

| Variable      | Default       |
|---------------|---------------|
| `PORT`        | `3000`        |
| `DB_HOST`     | `localhost`   |
| `DB_PORT`     | `5432`        |
| `DB_NAME`     | `urmonitor`   |
| `DB_USER`     | `urmonitor`   |
| `DB_PASSWORD` | `urmonitor`   |

## Deploying to Kubernetes

### Build the image

```bash
docker build -t ur-monitor:latest .
```

If using a remote registry, tag and push accordingly:

```bash
docker tag ur-monitor:latest your-registry/ur-monitor:latest
docker push your-registry/ur-monitor:latest
```

Then update the image in `k8s/app-deployment.yaml` to match.

### Deploy with Kustomize

```bash
kubectl apply -k k8s/
```

This creates:

- `ur-monitor` namespace
- PostgreSQL deployment with a 1Gi PersistentVolumeClaim
- App deployment connected to PostgreSQL
- ClusterIP services for both (app on port 80)

To expose the app externally, add an Ingress or change the service type to `LoadBalancer`/`NodePort`.

### Tear down

```bash
kubectl delete -k k8s/
```

## Project structure

```
server.js          Express server, API routes, background poller
db.js              PostgreSQL connection and schema init
monitor.js         UR property data fetching
webhook.js         Webhook HTTP POST caller
public/index.html  Single-page web UI
Dockerfile         Container image build
k8s/               Kubernetes Kustomize manifests
```
