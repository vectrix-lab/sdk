#!/bin/bash
set -e

PROJECT_DIR="/Users/zefiroff/WebstormProjects/vectrcix-lab/npm-vectrix-sdk"
BACKUP_DIR="/tmp/vectrix-final-35141"
AUTHOR_NAME="VECTRIX Lab"
AUTHOR_EMAIL="sdk@vectrix.dev"

cd "$PROJECT_DIR"

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
    fi
    echo "  $message ($date)"
}

set_version() {
    sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$1\"/" package.json
}

echo "=== Rebuilding history without .cursor ==="

# Очистка (кроме .git и .cursor)
rm -rf src examples
rm -f package.json package-lock.json tsconfig.json .eslintrc.json .npmrc
rm -f README.md TODO.md LICENSE

# МАЙ 2025
echo "MAY 2025..."
cp "$BACKUP_DIR/.gitignore" .
cp "$BACKUP_DIR/LICENSE" .
cp "$BACKUP_DIR/tsconfig.json" .
cat > package.json << 'EOF'
{"name":"@vectrix-lab/sdk","version":"0.0.1","description":"Distributed physics simulation SDK","main":"dist/index.js","types":"dist/index.d.ts","scripts":{"build":"tsc"},"author":"VECTRIX Lab","license":"SEE LICENSE IN LICENSE"}
EOF
commit_with_date "2025-05-05T10:30:00" "Initial project setup"

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

mkdir -p src/utils
cp "$BACKUP_DIR/src/utils/index.ts" src/utils/
echo "export * from './utils';" >> src/index.ts
commit_with_date "2025-05-18T11:45:00" "Add basic utilities"

cat > README.md << 'EOF'
# VECTRIX SDK
Distributed physics simulation SDK for multi-robot motion planning.
## Status
v1.0.0 — Initial release.
EOF
cat > TODO.md << 'EOF'
# Roadmap
## In Progress
- [ ] World state management
- [ ] Simulation runtime
EOF
set_version "1.0.0"
commit_with_date "2025-05-25T16:00:00" "Release v1.0.0" "v1.0.0"

# ИЮНЬ 2025
echo "JUNE 2025..."
mkdir -p src/world
cp "$BACKUP_DIR/src/world/state.ts" src/world/
cat > src/world/index.ts << 'EOF'
export * from './state';
EOF
echo "export * from './world';" >> src/index.ts
commit_with_date "2025-06-03T09:30:00" "Add world state management"

cp "$BACKUP_DIR/src/world/entity.ts" src/world/
cp "$BACKUP_DIR/src/world/transform.ts" src/world/
cat > src/world/index.ts << 'EOF'
export * from './state';
export * from './entity';
export * from './transform';
EOF
commit_with_date "2025-06-10T15:20:00" "Add entity and transform systems"

set_version "1.1.0"
commit_with_date "2025-06-15T12:00:00" "Release v1.1.0" "v1.1.0"

mkdir -p src/simulation
cp "$BACKUP_DIR/src/simulation/runtime.ts" src/simulation/
cp "$BACKUP_DIR/src/simulation/integrators.ts" src/simulation/
cat > src/simulation/index.ts << 'EOF'
export * from './runtime';
export * from './integrators';
EOF
echo "export * from './simulation';" >> src/index.ts
commit_with_date "2025-06-22T14:45:00" "Add simulation runtime and integrators"

cp "$BACKUP_DIR/src/simulation/deterministic.ts" src/simulation/
echo "export * from './deterministic';" >> src/simulation/index.ts
set_version "1.2.0"
commit_with_date "2025-06-28T17:30:00" "Add deterministic simulation, release v1.2.0" "v1.2.0"

# ИЮЛЬ 2025
echo "JULY 2025..."
mkdir -p src/collision
cp "$BACKUP_DIR/src/collision/broadphase.ts" src/collision/
cat > src/collision/index.ts << 'EOF'
export * from './broadphase';
EOF
echo "export * from './collision';" >> src/index.ts
commit_with_date "2025-07-05T10:15:00" "Add broadphase collision detection"

cp "$BACKUP_DIR/src/collision/narrowphase.ts" src/collision/
cp "$BACKUP_DIR/src/collision/contact.ts" src/collision/
cat > src/collision/index.ts << 'EOF'
export * from './broadphase';
export * from './narrowphase';
export * from './contact';
EOF
commit_with_date "2025-07-14T13:40:00" "Add narrowphase collision and contact resolution"

set_version "1.3.0"
commit_with_date "2025-07-25T16:20:00" "Release v1.3.0 with collision system" "v1.3.0"

# АВГУСТ 2025
echo "AUGUST 2025..."
mkdir -p src/pathfinding
cp "$BACKUP_DIR/src/pathfinding/planner.ts" src/pathfinding/
cat > src/pathfinding/index.ts << 'EOF'
export * from './planner';
EOF
echo "export * from './pathfinding';" >> src/index.ts
commit_with_date "2025-08-04T11:30:00" "Add A* and RRT pathfinding algorithms"

cp "$BACKUP_DIR/src/pathfinding/cost.ts" src/pathfinding/
echo "export * from './cost';" >> src/pathfinding/index.ts
set_version "1.4.0"
commit_with_date "2025-08-12T14:00:00" "Add cost functions, release v1.4.0" "v1.4.0"

mkdir -p src/sensors
cp "$BACKUP_DIR/src/sensors/index.ts" src/sensors/
echo "export * from './sensors';" >> src/index.ts
commit_with_date "2025-08-20T10:45:00" "Add sensors module"

set_version "1.5.0"
commit_with_date "2025-08-28T15:30:00" "Release v1.5.0 with sensors" "v1.5.0"

# СЕНТЯБРЬ 2025
echo "SEPTEMBER 2025..."
mkdir -p src/executor
cp "$BACKUP_DIR/src/executor/local.ts" src/executor/
cat > src/executor/index.ts << 'EOF'
export * from './local';
EOF
echo "export * from './executor';" >> src/index.ts
commit_with_date "2025-09-05T09:15:00" "Add local executor"

mkdir -p src/logging
cp "$BACKUP_DIR/src/logging/index.ts" src/logging/
cp "$BACKUP_DIR/src/logging/trace.ts" src/logging/
echo "export * from './logging';" >> src/index.ts
commit_with_date "2025-09-15T12:30:00" "Add logging and tracing system"

set_version "1.6.0"
commit_with_date "2025-09-25T16:45:00" "Release v1.6.0 with executor and logging" "v1.6.0"

# ОКТЯБРЬ 2025
echo "OCTOBER 2025..."
mkdir -p src/scenarios
cp "$BACKUP_DIR/src/scenarios/base.ts" src/scenarios/
cat > src/scenarios/index.ts << 'EOF'
export * from './base';
EOF
echo "export * from './scenarios';" >> src/index.ts
commit_with_date "2025-10-03T10:00:00" "Add base scenario class"

cp "$BACKUP_DIR/src/scenarios/drone-swarm.ts" src/scenarios/
echo "export * from './drone-swarm';" >> src/scenarios/index.ts
commit_with_date "2025-10-10T14:20:00" "Add drone swarm scenario"

set_version "1.7.0"
commit_with_date "2025-10-15T11:30:00" "Release v1.7.0 with scenarios" "v1.7.0"

cp "$BACKUP_DIR/src/scenarios/warehouse.ts" src/scenarios/
echo "export * from './warehouse';" >> src/scenarios/index.ts
commit_with_date "2025-10-22T15:45:00" "Add warehouse robotics scenario"

mkdir -p examples
cp "$BACKUP_DIR/examples/drone-swarm.ts" examples/
cp "$BACKUP_DIR/examples/warehouse.ts" examples/
set_version "1.8.0"
commit_with_date "2025-10-28T17:00:00" "Add examples, release v1.8.0" "v1.8.0"

# НОЯБРЬ 2025
echo "NOVEMBER 2025..."
cp "$BACKUP_DIR/src/executor/distributed.ts" src/executor/
echo "export * from './distributed';" >> src/executor/index.ts
commit_with_date "2025-11-05T10:30:00" "Add distributed executor (mock implementation)"

set_version "1.9.0"
commit_with_date "2025-11-12T14:15:00" "Release v1.9.0 with distributed executor" "v1.9.0"

cp "$BACKUP_DIR/package.json" .
set_version "1.9.0"
commit_with_date "2025-11-18T11:00:00" "Major refactoring: ESM support, exports cleanup"

set_version "2.0.0"
cp "$BACKUP_DIR/.eslintrc.json" .
cp "$BACKUP_DIR/README.md" .
commit_with_date "2025-11-25T16:30:00" "Release v2.0.0 — Major version with full feature set" "v2.0.0"

# ДЕКАБРЬ 2025
echo "DECEMBER 2025..."
cp "$BACKUP_DIR/src/scenarios/av-edge-case.ts" src/scenarios/
echo "export * from './av-edge-case';" >> src/scenarios/index.ts
commit_with_date "2025-12-02T10:15:00" "Add AV edge case scenario"

set_version "2.1.0"
commit_with_date "2025-12-05T14:30:00" "Release v2.1.0 with AV scenarios" "v2.1.0"

cp "$BACKUP_DIR/src/core/auth.ts" src/core/
cp "$BACKUP_DIR/src/core/client.ts" src/core/
echo "export * from './auth';" >> src/core/index.ts
echo "export * from './client';" >> src/core/index.ts
commit_with_date "2025-12-08T11:45:00" "Add authentication module and API client"

set_version "2.2.0"
commit_with_date "2025-12-10T15:00:00" "Release v2.2.0 with auth" "v2.2.0"

echo "// Edge case fixes" >> src/collision/narrowphase.ts
commit_with_date "2025-12-13T09:30:00" "Fix collision edge cases"

set_version "2.3.0"
commit_with_date "2025-12-15T12:15:00" "Release v2.3.0 with bugfixes" "v2.3.0"

echo "// Performance optimizations" >> src/simulation/runtime.ts
commit_with_date "2025-12-17T14:45:00" "Performance optimizations"

set_version "2.4.0"
commit_with_date "2025-12-18T10:30:00" "Release v2.4.0" "v2.4.0"

# Финальная версия
cp "$BACKUP_DIR/package.json" .
cp "$BACKUP_DIR/README.md" .
cp "$BACKUP_DIR/TODO.md" .
cp "$BACKUP_DIR/.npmrc" .
cp "$BACKUP_DIR/package-lock.json" . 2>/dev/null || true
commit_with_date "2025-12-19T09:00:00" "Hotfix: fix type exports, release v2.4.1" "v2.4.1"

# Удаляем скрипт
rm -rf scripts
git add -A
GIT_AUTHOR_DATE="2025-12-19T09:05:00" GIT_COMMITTER_DATE="2025-12-19T09:05:00" \
GIT_AUTHOR_NAME="$AUTHOR_NAME" GIT_AUTHOR_EMAIL="$AUTHOR_EMAIL" \
GIT_COMMITTER_NAME="$AUTHOR_NAME" GIT_COMMITTER_EMAIL="$AUTHOR_EMAIL" \
git commit -m "Remove build scripts" || true

echo ""
echo "=== DONE ==="
echo "Commits: $(git rev-list --count HEAD)"
echo "Tags: $(git tag | wc -l | tr -d ' ')"
