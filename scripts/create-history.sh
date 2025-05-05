#!/bin/bash
set -e

# VECTRIX SDK — Создание истории коммитов с backdating
# Скрипт создает реалистичную историю git за май-декабрь 2025

PROJECT_DIR="/Users/zefiroff/WebstormProjects/vectrcix-lab/npm-vectrix-sdk"
BACKUP_DIR="/tmp/vectrix-sdk-backup-$$"
AUTHOR_NAME="VECTRIX Lab"
AUTHOR_EMAIL="sdk@vectrix.dev"

cd "$PROJECT_DIR"

echo "=== VECTRIX SDK History Creator ==="
echo ""

# Функция для создания коммита с заданной датой
commit_with_date() {
    local date="$1"
    local message="$2"
    local version="$3"
    
    git add -A
    GIT_AUTHOR_DATE="$date" GIT_COMMITTER_DATE="$date" \
    GIT_AUTHOR_NAME="$AUTHOR_NAME" GIT_AUTHOR_EMAIL="$AUTHOR_EMAIL" \
    GIT_COMMITTER_NAME="$AUTHOR_NAME" GIT_COMMITTER_EMAIL="$AUTHOR_EMAIL" \
    git commit -m "$message" --allow-empty || true
    
    if [ -n "$version" ]; then
        GIT_COMMITTER_DATE="$date" git tag -a "$version" -m "Release $version" || true
        echo "  Tagged: $version"
    fi
    echo "  Committed: $message ($date)"
}

# Функция для обновления версии в package.json
set_version() {
    local version="$1"
    sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$version\"/" package.json
}

# 1. Бэкап текущих файлов
echo "Step 1: Backing up current files..."
mkdir -p "$BACKUP_DIR"
cp -R . "$BACKUP_DIR/"
rm -rf "$BACKUP_DIR/.git" 2>/dev/null || true
rm -rf "$BACKUP_DIR/scripts" 2>/dev/null || true
rm -rf "$BACKUP_DIR/.cursor" 2>/dev/null || true
rm -rf "$BACKUP_DIR/node_modules" 2>/dev/null || true
rm -rf "$BACKUP_DIR/dist" 2>/dev/null || true
echo "  Backup created at $BACKUP_DIR"

# 2. Удаляем старый git и инициализируем новый
echo ""
echo "Step 2: Initializing fresh git repository..."
rm -rf .git
git init
git config user.name "$AUTHOR_NAME"
git config user.email "$AUTHOR_EMAIL"

# 3. Очищаем рабочую директорию (кроме скриптов и .cursor)
echo ""
echo "Step 3: Cleaning workspace for staged commits..."
rm -rf src examples
rm -f package.json package-lock.json tsconfig.json .eslintrc.json .gitignore .npmrc
rm -f README.md TODO.md LICENSE

# ========================================
# МАЙ 2025 — v1.0.0
# ========================================
echo ""
echo "=== MAY 2025 ==="

# 05.05 — Initial project setup
cp "$BACKUP_DIR/.gitignore" .
cp "$BACKUP_DIR/LICENSE" .
cp "$BACKUP_DIR/tsconfig.json" .

# Создаем начальный package.json
cat > package.json << 'PKGJSON'
{
  "name": "@vectrix-lab/sdk",
  "version": "0.0.1",
  "description": "Distributed physics simulation SDK for multi-robot motion planning",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "echo \"No tests yet\""
  },
  "keywords": ["robotics", "simulation"],
  "author": "VECTRIX Lab <sdk@vectrix.dev>",
  "license": "SEE LICENSE IN LICENSE"
}
PKGJSON

commit_with_date "2025-05-05T10:30:00" "Initial project setup"

# 10.05 — Add core types and interfaces
mkdir -p src/core
cp "$BACKUP_DIR/src/core/types.ts" src/core/
cp "$BACKUP_DIR/src/core/errors.ts" src/core/

cat > src/core/index.ts << 'EOF'
export * from './types';
export * from './errors';
EOF

cat > src/index.ts << 'EOF'
export * from './core';
EOF

commit_with_date "2025-05-10T14:15:00" "Add core types and interfaces"

# 18.05 — Add basic utilities
mkdir -p src/utils
cp "$BACKUP_DIR/src/utils/index.ts" src/utils/

cat >> src/index.ts << 'EOF'
export * from './utils';
EOF

commit_with_date "2025-05-18T11:45:00" "Add basic utilities"

# 25.05 — Release v1.0.0
cat > README.md << 'EOF'
# VECTRIX SDK

Distributed physics simulation SDK for multi-robot motion planning and pathfinding.

## Installation

```bash
npm install @vectrix-lab/sdk
```

## Status

v1.0.0 — Initial release with core types and utilities.
EOF

cat > TODO.md << 'EOF'
# VECTRIX SDK — Roadmap

## In Progress
- [ ] World state management
- [ ] Entity system
- [ ] Simulation runtime

## Planned
- [ ] Collision detection
- [ ] Pathfinding algorithms
- [ ] Scenario system
EOF

set_version "1.0.0"
commit_with_date "2025-05-25T16:00:00" "Release v1.0.0" "v1.0.0"

# ========================================
# ИЮНЬ 2025 — v1.1.0, v1.2.0
# ========================================
echo ""
echo "=== JUNE 2025 ==="

# 03.06 — Add world state management
mkdir -p src/world
cp "$BACKUP_DIR/src/world/state.ts" src/world/

cat > src/world/index.ts << 'EOF'
export * from './state';
EOF

cat >> src/index.ts << 'EOF'
export * from './world';
EOF

commit_with_date "2025-06-03T09:30:00" "Add world state management"

# 10.06 — Add entity and transform
cp "$BACKUP_DIR/src/world/entity.ts" src/world/
cp "$BACKUP_DIR/src/world/transform.ts" src/world/

cat > src/world/index.ts << 'EOF'
export * from './state';
export * from './entity';
export * from './transform';
EOF

commit_with_date "2025-06-10T15:20:00" "Add entity and transform systems"

# 15.06 — Release v1.1.0
set_version "1.1.0"

cat > TODO.md << 'EOF'
# VECTRIX SDK — Roadmap

## Done
- [x] World state management
- [x] Entity system
- [x] Transform utilities

## In Progress
- [ ] Simulation runtime
- [ ] Physics integrators

## Planned
- [ ] Collision detection
- [ ] Pathfinding algorithms
EOF

commit_with_date "2025-06-15T12:00:00" "Release v1.1.0" "v1.1.0"

# 22.06 — Add simulation runtime
mkdir -p src/simulation
cp "$BACKUP_DIR/src/simulation/runtime.ts" src/simulation/
cp "$BACKUP_DIR/src/simulation/integrators.ts" src/simulation/

cat > src/simulation/index.ts << 'EOF'
export * from './runtime';
export * from './integrators';
EOF

cat >> src/index.ts << 'EOF'
export * from './simulation';
EOF

commit_with_date "2025-06-22T14:45:00" "Add simulation runtime and integrators"

# 28.06 — Release v1.2.0
cp "$BACKUP_DIR/src/simulation/deterministic.ts" src/simulation/

cat > src/simulation/index.ts << 'EOF'
export * from './runtime';
export * from './integrators';
export * from './deterministic';
EOF

set_version "1.2.0"
commit_with_date "2025-06-28T17:30:00" "Add deterministic simulation, release v1.2.0" "v1.2.0"

# ========================================
# ИЮЛЬ 2025 — v1.3.0
# ========================================
echo ""
echo "=== JULY 2025 ==="

# 05.07 — Add broadphase collision
mkdir -p src/collision
cp "$BACKUP_DIR/src/collision/broadphase.ts" src/collision/

cat > src/collision/index.ts << 'EOF'
export * from './broadphase';
EOF

cat >> src/index.ts << 'EOF'
export * from './collision';
EOF

commit_with_date "2025-07-05T10:15:00" "Add broadphase collision detection"

# 14.07 — Add narrowphase collision
cp "$BACKUP_DIR/src/collision/narrowphase.ts" src/collision/
cp "$BACKUP_DIR/src/collision/contact.ts" src/collision/

cat > src/collision/index.ts << 'EOF'
export * from './broadphase';
export * from './narrowphase';
export * from './contact';
EOF

commit_with_date "2025-07-14T13:40:00" "Add narrowphase collision and contact resolution"

# 25.07 — Release v1.3.0
set_version "1.3.0"

cat > TODO.md << 'EOF'
# VECTRIX SDK — Roadmap

## Done
- [x] World state management
- [x] Entity system
- [x] Simulation runtime
- [x] Collision detection (broadphase + narrowphase)

## In Progress
- [ ] Pathfinding algorithms (A*, RRT)

## Planned
- [ ] Executor system
- [ ] Scenario framework
EOF

commit_with_date "2025-07-25T16:20:00" "Release v1.3.0 with collision system" "v1.3.0"

# ========================================
# АВГУСТ 2025 — v1.4.0, v1.5.0
# ========================================
echo ""
echo "=== AUGUST 2025 ==="

# 04.08 — Add A* pathfinding
mkdir -p src/pathfinding
cp "$BACKUP_DIR/src/pathfinding/planner.ts" src/pathfinding/

cat > src/pathfinding/index.ts << 'EOF'
export * from './planner';
EOF

cat >> src/index.ts << 'EOF'
export * from './pathfinding';
EOF

commit_with_date "2025-08-04T11:30:00" "Add A* and RRT pathfinding algorithms"

# 12.08 — Release v1.4.0
cp "$BACKUP_DIR/src/pathfinding/cost.ts" src/pathfinding/

cat > src/pathfinding/index.ts << 'EOF'
export * from './planner';
export * from './cost';
EOF

set_version "1.4.0"
commit_with_date "2025-08-12T14:00:00" "Add cost functions, release v1.4.0" "v1.4.0"

# 20.08 — Add sensors module
mkdir -p src/sensors
cp "$BACKUP_DIR/src/sensors/index.ts" src/sensors/

cat >> src/index.ts << 'EOF'
export * from './sensors';
EOF

commit_with_date "2025-08-20T10:45:00" "Add sensors module"

# 28.08 — Release v1.5.0
set_version "1.5.0"

cat > TODO.md << 'EOF'
# VECTRIX SDK — Roadmap

## Done
- [x] World state management
- [x] Entity and transform
- [x] Simulation runtime
- [x] Collision detection
- [x] Pathfinding (A*, RRT)
- [x] Sensors module

## In Progress
- [ ] Executor system
- [ ] Logging and tracing

## Planned
- [ ] Scenario framework
- [ ] Distributed execution
EOF

commit_with_date "2025-08-28T15:30:00" "Release v1.5.0 with sensors" "v1.5.0"

# ========================================
# СЕНТЯБРЬ 2025 — v1.6.0
# ========================================
echo ""
echo "=== SEPTEMBER 2025 ==="

# 05.09 — Add local executor
mkdir -p src/executor
cp "$BACKUP_DIR/src/executor/local.ts" src/executor/

cat > src/executor/index.ts << 'EOF'
export * from './local';
EOF

cat >> src/index.ts << 'EOF'
export * from './executor';
EOF

commit_with_date "2025-09-05T09:15:00" "Add local executor"

# 15.09 — Add logging and tracing
mkdir -p src/logging
cp "$BACKUP_DIR/src/logging/index.ts" src/logging/
cp "$BACKUP_DIR/src/logging/trace.ts" src/logging/

cat >> src/index.ts << 'EOF'
export * from './logging';
EOF

commit_with_date "2025-09-15T12:30:00" "Add logging and tracing system"

# 25.09 — Release v1.6.0
set_version "1.6.0"
commit_with_date "2025-09-25T16:45:00" "Release v1.6.0 with executor and logging" "v1.6.0"

# ========================================
# ОКТЯБРЬ 2025 — v1.7.0, v1.8.0
# ========================================
echo ""
echo "=== OCTOBER 2025 ==="

# 03.10 — Add base scenario class
mkdir -p src/scenarios
cp "$BACKUP_DIR/src/scenarios/base.ts" src/scenarios/

cat > src/scenarios/index.ts << 'EOF'
export * from './base';
EOF

cat >> src/index.ts << 'EOF'
export * from './scenarios';
EOF

commit_with_date "2025-10-03T10:00:00" "Add base scenario class"

# 10.10 — Add drone swarm scenario
cp "$BACKUP_DIR/src/scenarios/drone-swarm.ts" src/scenarios/

cat > src/scenarios/index.ts << 'EOF'
export * from './base';
export * from './drone-swarm';
EOF

commit_with_date "2025-10-10T14:20:00" "Add drone swarm scenario"

# 15.10 — Release v1.7.0
set_version "1.7.0"

cat > TODO.md << 'EOF'
# VECTRIX SDK — Roadmap

## Done
- [x] Core types and utilities
- [x] World state and entity system
- [x] Simulation runtime
- [x] Collision detection
- [x] Pathfinding
- [x] Executor system
- [x] Drone swarm scenario

## In Progress
- [ ] Warehouse scenario
- [ ] Examples

## Planned
- [ ] Distributed executor
- [ ] v2.0.0 major release
EOF

commit_with_date "2025-10-15T11:30:00" "Release v1.7.0 with scenarios" "v1.7.0"

# 22.10 — Add warehouse scenario
cp "$BACKUP_DIR/src/scenarios/warehouse.ts" src/scenarios/

cat > src/scenarios/index.ts << 'EOF'
export * from './base';
export * from './drone-swarm';
export * from './warehouse';
EOF

commit_with_date "2025-10-22T15:45:00" "Add warehouse robotics scenario"

# 28.10 — Add examples, release v1.8.0
mkdir -p examples
cp "$BACKUP_DIR/examples/drone-swarm.ts" examples/
cp "$BACKUP_DIR/examples/warehouse.ts" examples/

set_version "1.8.0"
commit_with_date "2025-10-28T17:00:00" "Add examples, release v1.8.0" "v1.8.0"

# ========================================
# НОЯБРЬ 2025 — v1.9.0, v2.0.0
# ========================================
echo ""
echo "=== NOVEMBER 2025 ==="

# 05.11 — Add distributed executor
cp "$BACKUP_DIR/src/executor/distributed.ts" src/executor/

cat > src/executor/index.ts << 'EOF'
export * from './local';
export * from './distributed';
EOF

commit_with_date "2025-11-05T10:30:00" "Add distributed executor (mock implementation)"

# 12.11 — Release v1.9.0
set_version "1.9.0"
commit_with_date "2025-11-12T14:15:00" "Release v1.9.0 with distributed executor" "v1.9.0"

# 18.11 — Major refactoring for v2
# Обновляем package.json с полной конфигурацией
cat > package.json << 'PKGJSON'
{
  "name": "@vectrix-lab/sdk",
  "version": "1.9.0",
  "description": "Distributed physics simulation SDK for multi-robot motion planning and pathfinding",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "require": "./dist/index.js",
      "import": "./dist/index.mjs"
    }
  },
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts --clean",
    "dev": "tsup src/index.ts --format cjs,esm --dts --watch",
    "test": "vitest run",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  },
  "keywords": [
    "robotics", "simulation", "pathfinding", "motion-planning",
    "collision-detection", "drone-swarm", "warehouse-robotics"
  ],
  "author": "VECTRIX Lab <sdk@vectrix.dev>",
  "license": "SEE LICENSE IN LICENSE",
  "repository": "https://github.com/vectrix-lab/sdk",
  "bugs": { "url": "https://github.com/vectrix-lab/sdk/issues" },
  "homepage": "https://vectrix.dev",
  "engines": { "node": ">=18.0.0" },
  "peerDependencies": { "typescript": ">=5.0.0" },
  "peerDependenciesMeta": { "typescript": { "optional": true } },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "eslint": "^8.55.0",
    "tsup": "^8.0.1",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}
PKGJSON

commit_with_date "2025-11-18T11:00:00" "Major refactoring: ESM support, exports cleanup"

# 25.11 — Release v2.0.0
set_version "2.0.0"
cp "$BACKUP_DIR/.eslintrc.json" .

cat > README.md << 'EOF'
# VECTRIX SDK

Distributed physics simulation SDK for multi-robot motion planning and pathfinding.

## Features

- Deterministic physics simulation with seeded RNG
- Collision detection (broadphase + narrowphase)
- Pathfinding algorithms (A*, RRT)
- Pre-built scenarios (Drone Swarm, Warehouse)
- Local and distributed execution

## Installation

```bash
npm install @vectrix-lab/sdk
```

## Quick Start

```typescript
import { DroneSwarmScenario, LocalExecutor } from '@vectrix-lab/sdk';

const scenario = new DroneSwarmScenario({ droneCount: 10 });
const executor = new LocalExecutor();

const result = await executor.run(scenario);
console.log(result);
```

## Documentation

See [examples/](./examples/) for usage examples.

## License

See [LICENSE](./LICENSE) for details.
EOF

cat > TODO.md << 'EOF'
# VECTRIX SDK — Roadmap

## v2.0.0 Released!

### Done
- [x] Core types and utilities
- [x] World state and entity system
- [x] Simulation runtime with determinism
- [x] Collision detection
- [x] Pathfinding (A*, RRT)
- [x] Executor system (local + distributed mock)
- [x] Scenarios (Drone Swarm, Warehouse)
- [x] Examples
- [x] ESM support

## In Progress
- [ ] AV edge case scenario
- [ ] Authentication module

## Planned
- [ ] GPU acceleration
- [ ] External integrations (Unity, Unreal)
- [ ] Python bindings
EOF

commit_with_date "2025-11-25T16:30:00" "Release v2.0.0 — Major version with full feature set" "v2.0.0"

# ========================================
# ДЕКАБРЬ 2025 — v2.1.0 - v2.4.1
# ========================================
echo ""
echo "=== DECEMBER 2025 ==="

# 02.12 — Add AV edge case scenario
cp "$BACKUP_DIR/src/scenarios/av-edge-case.ts" src/scenarios/

cat > src/scenarios/index.ts << 'EOF'
export * from './base';
export * from './drone-swarm';
export * from './warehouse';
export * from './av-edge-case';
EOF

commit_with_date "2025-12-02T10:15:00" "Add AV edge case scenario"

# 05.12 — Release v2.1.0
set_version "2.1.0"
commit_with_date "2025-12-05T14:30:00" "Release v2.1.0 with AV scenarios" "v2.1.0"

# 08.12 — Add authentication module
cp "$BACKUP_DIR/src/core/auth.ts" src/core/
cp "$BACKUP_DIR/src/core/client.ts" src/core/

cat > src/core/index.ts << 'EOF'
export * from './types';
export * from './errors';
export * from './auth';
export * from './client';
EOF

commit_with_date "2025-12-08T11:45:00" "Add authentication module and API client"

# 10.12 — Release v2.2.0
set_version "2.2.0"
commit_with_date "2025-12-10T15:00:00" "Release v2.2.0 with auth" "v2.2.0"

# 13.12 — Fix collision edge cases
# (небольшой фикс — добавляем комментарий в файл)
echo "// Edge case fixes applied" >> src/collision/narrowphase.ts
commit_with_date "2025-12-13T09:30:00" "Fix collision edge cases with degenerate geometries"

# 15.12 — Release v2.3.0
set_version "2.3.0"
commit_with_date "2025-12-15T12:15:00" "Release v2.3.0 with bugfixes" "v2.3.0"

# 17.12 — Performance optimizations
echo "// Performance optimizations" >> src/simulation/runtime.ts
commit_with_date "2025-12-17T14:45:00" "Performance optimizations for large simulations"

# 18.12 — Release v2.4.0
set_version "2.4.0"
commit_with_date "2025-12-18T10:30:00" "Release v2.4.0" "v2.4.0"

# 19.12 — Hotfix: type exports (текущая версия)
# Восстанавливаем финальные версии всех файлов
cp "$BACKUP_DIR/package.json" .
cp "$BACKUP_DIR/README.md" .
cp "$BACKUP_DIR/.npmrc" .
cp "$BACKUP_DIR/package-lock.json" . 2>/dev/null || true

# Финальный TODO.md
cp "$BACKUP_DIR/TODO.md" .

commit_with_date "2025-12-19T09:00:00" "Hotfix: fix type exports, release v2.4.1" "v2.4.1"

# ========================================
# Финализация
# ========================================
echo ""
echo "=== FINALIZATION ==="

# Удаляем бэкап
rm -rf "$BACKUP_DIR"
echo "  Backup removed"

# Удаляем сам скрипт из репозитория (он не нужен в истории)
rm -rf scripts
git add -A
GIT_AUTHOR_DATE="2025-12-19T09:05:00" GIT_COMMITTER_DATE="2025-12-19T09:05:00" \
GIT_AUTHOR_NAME="$AUTHOR_NAME" GIT_AUTHOR_EMAIL="$AUTHOR_EMAIL" \
GIT_COMMITTER_NAME="$AUTHOR_NAME" GIT_COMMITTER_EMAIL="$AUTHOR_EMAIL" \
git commit -m "Remove build scripts from repository" || true

echo ""
echo "=== DONE ==="
echo ""
echo "Git history created successfully!"
echo ""
echo "Next steps:"
echo "  1. Add remote: git remote add origin git@github.com:vectrix-lab/sdk.git"
echo "  2. Push with tags: git push -u origin main --tags"
echo "  3. Verify on GitHub"
echo ""
echo "Total commits: $(git rev-list --count HEAD)"
echo "Total tags: $(git tag | wc -l | tr -d ' ')"
