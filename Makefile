.PHONY: dev build serve test seed clean deploy deploy-minor deploy-major verify

# ── Development ──────────────────────────────────────────────

dev:            ## Start dev server (API :3100 + web :3102)
	bun run dev

build:          ## Build web assets to src/web/dist/
	bun run build

serve:          ## Build + start production server
	bun run serve

seed:           ## Seed dev DB with realistic test data
	bun run seed

# ── Verification ─────────────────────────────────────────────

test:           ## Run all tests (domain + API + web)
	bun run test

verify: test build  ## Run tests then build — full pre-deploy check

# ── Deploy ───────────────────────────────────────────────────

deploy: verify  ## Bump patch, tag, push (runs verify first)
	./deploy.sh patch

deploy-minor: verify  ## Bump minor, tag, push
	./deploy.sh minor

deploy-major: verify  ## Bump major, tag, push
	./deploy.sh major

# ── Housekeeping ─────────────────────────────────────────────

clean:          ## Remove build artifacts
	rm -rf src/web/dist

# ── Help ─────────────────────────────────────────────────────

help:           ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
