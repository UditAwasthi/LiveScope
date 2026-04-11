```markdown
# LiveScope — Engineering Documentation

LiveScope is a scalable, event‑driven monorepo system built for real‑time distributed workloads.  
This document describes the architecture, setup, and foundations laid in **Step 1** (monorepo & build) and **Step 2** (Kafka‑based event backbone).

---

## 🧱 Step 1 — Monorepo & Build System Setup

### 🎯 Objective
Establish a scalable monorepo architecture with:
- Multiple services (`apps`)
- Shared libraries (`packages`)
- Centralized build system
- Type‑safe development

### 🏗️ Architecture Overview
```
livescope/
├── apps/        → runtime services
├── packages/    → shared logic
├── infra/       → infrastructure configs
├── scripts/     → utilities
```

### 1. Monorepo Strategy
We used a **monorepo** architecture to:
- Maintain a single codebase for all services  
- Enable code reuse across services  
- Simplify dependency management  

**Service Structure:**
```bash
apps/
  gateway/
  projection-engine/
  stream-engine/
  websocket-gateway/
  anomaly-detector/
  chaos-engine/
  region-simulator/
  dashboard/
```

**Shared Libraries:**
```bash
packages/
  sdk/
  event-schemas/
  vector-clock/
  crdt/
  diff-engine/
  query-engine/
  utils/
```

### 2. pnpm Workspaces
Configured in `pnpm-workspace.yaml`:
```yaml
packages:
  - apps/*
  - packages/*
```

**Purpose:**
- Links all packages internally  
- Avoids publishing to npm  
- Enables direct, type‑safe imports:

```ts
import { logger } from "@livescope/utils";
```

### 3. Turborepo Build System
`.turbo/config.json` pipeline:
```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
```

**Key Features:**
- Dependency‑aware builds  
- Parallel execution  
- Incremental caching  

**Example Build Flow:**
```
@livescope/utils → gateway
1. build utils
2. build gateway
```

### 4. Package Standardization
Each package follows a consistent layout:
```json
{
  "name": "@livescope/<package>",
  "version": "1.0.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  }
}
```

### 5. TypeScript Configuration
**Base Config (`tsconfig.base.json`):**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "strict": true,
    "declaration": true,
    "outDir": "dist"
  }
}
```

**Per‑package Config:**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  }
}
```

### 6. Build Output
Each package:
- `src/` → source code  
- `dist/` → compiled output  

**Example:**
```bash
dist/
  index.js
  index.d.ts
```

### 7. Achievements — Step 1
✅ Modular architecture  
✅ Shared package system  
✅ Type‑safe cross‑package imports  
✅ Optimized build pipeline  
✅ Incremental caching enabled  

---

## 🚀 Step 2 — Distributed Infrastructure Setup

### 🎯 Objective
Build a **local distributed event streaming infrastructure** using:
- Apache Kafka  
- Zookeeper  
- Schema Registry  
- Docker Compose  

### 🏗️ System Architecture
```
           +------------------+
           |   Producers      |
           +--------+---------+
                    |
                    ▼
              +-----------+
              |  Kafka    |
              +-----------+
                    |
                    ▼
           +------------------+
           |   Consumers      |
           +------------------+

              +------------------+
              | Schema Registry  |
              +------------------+
```

### 1. Kafka (Event Streaming Layer)
**Role:**
- Central message broker  
- Enables asynchronous communication  
- Decouples services  

**Configuration (local):**
- Single broker  
- Port: `9092`  

**Functionality:**
- Stores events in topics  
- Supports partitioning  
- Enables scalable processing  

### 2. Zookeeper
**Role:**
- Manages Kafka cluster metadata  
- Handles broker coordination  

### 3. Schema Registry
**Endpoint:**
```
http://localhost:8081
```

**Role:**
- Stores event schemas  
- Enforces data contracts  
- Handles schema evolution  

**Important Fix (local):**
```yaml
SCHEMA_REGISTRY_KAFKASTORE_TOPIC_REPLICATION_FACTOR: 1
```

👉 Required to avoid local replication issues.

### 4. Kafka Topics
Created topics:
- `metrics.raw` — performance metrics  
- `logs.raw` — application logs  
- `traces.raw` — request tracing  
- `events.dlq` — dead‑letter queue  

### 5. Docker Compose
**Benefits:**
- One‑command setup  
- Isolated environment  
- Reproducible infrastructure  

**Command:**
```bash
docker compose up -d
```

### 6. Key Challenges Solved
✔ Networking issues — fixed internal vs external Kafka listeners  
✔ Schema Registry failures — fixed replication factor mismatch  
✔ Orphan containers — removed stale brokers (`kafka‑2`, `kafka‑3`)  
✔ Startup dependencies — simplified service dependencies  

### 7. Final Working State
**Running Services:**
- Kafka broker  
- Zookeeper  
- Schema Registry  

**Verification:**
```bash
curl http://localhost:8081
# → returns: []
```

### 8. Event Flow
```
Producer → Kafka → Consumer
           ↑
    Schema Registry
```

### 9. Achievements — Step 2
✅ Event‑driven architecture foundation  
✅ Kafka‑based communication layer  
✅ Schema enforcement system  
✅ Topic‑based data segregation  
✅ Containerized infrastructure  

---

## 🧠 Overall System State (After Step 2)

You now have:
- ✔ **Modular Codebase** (Step 1)  
- ✔ **Distributed Event Backbone** (Step 2)  

### 🔥 Combined Architecture
```
apps (services)
   ↓
Kafka (event bus)
   ↓
consumers
   ↑
packages (shared logic)
```

### 🎯 What This Enables
You are now ready to:
- Implement event producers (SDK / Gateway)  
- Build consumers (Projection Engine)  
- Enforce schemas (Avro)  
- Stream real‑time data (WebSocket Gateway)  

---

## 🚀 Next Step — Step 3: Event Schemas (Avro + TypeScript)

**Step 3 will:**
- Define strict event contracts  
- Integrate with Schema Registry  
- Enable safe, type‑driven communication across services  

This documentation can be reused as a **README**, **portfolio case‑study**, or internal design spec.  
```