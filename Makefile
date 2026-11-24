SHELL := /bin/bash
ROOT_DIR := $(shell pwd)
API_DIR := $(ROOT_DIR)/api

.PHONY: setup dev test test-unit lint format-check build seed reset-db smoke-test security reasons-lint branch-name-check eval eval-agentic prod-up prod-down prod-logs

## setup: Install dependencies, generate Prisma client, push schema, seed database
setup:
	pnpm install
	@if [ ! -f .env ]; then cp .env.example .env; echo "Created .env from .env.example"; fi
	@cp .env $(API_DIR)/.env
	cd $(API_DIR) && pnpm exec prisma generate
	cd $(API_DIR) && pnpm exec prisma db push
	$(MAKE) seed
	@echo "Setup complete. Run 'make dev' to start."

## dev: Start frontend and backend in development mode
dev:
	pnpm run dev

## test: Run all tests (unit + integration)
test:
	pnpm run test

## test-unit: Run unit tests only (no database required)
test-unit:
	cd $(API_DIR) && pnpm run test:unit

## lint: Run ESLint on all packages
lint:
	pnpm run lint

## format-check: Check Prettier formatting on all packages
format-check:
	pnpm run format-check

## build: Build frontend and backend
build:
	pnpm run build

## seed: Seed the SQLite database with sample data
seed:
	cd $(API_DIR) && pnpm exec prisma db seed

## reset-db: Reset and re-seed the SQLite database
reset-db:
	cd $(API_DIR) && pnpm exec prisma db push --force-reset
	$(MAKE) seed

## smoke-test: Run smoke tests against a running application
smoke-test:
	@bash scripts/smoke-test.sh

## security: Run local security checks (Gitleaks + Trivy)
security:
	@bash scripts/security.sh

## prod-up: Start production-like environment with Docker Compose
prod-up:
	docker compose -f docker-compose.prod.yml up -d --build
	@echo "Production environment started. Run 'make smoke-test' to verify."

## prod-down: Stop production-like environment
prod-down:
	docker compose -f docker-compose.prod.yml down

## prod-logs: Show production environment logs
prod-logs:
	docker compose -f docker-compose.prod.yml logs

help:
	@grep -E '^## ' Makefile | sed 's/^## /  /'

## reasons-lint: Check SPDD prompt files follow the REASONS Canvas structure
reasons-lint:
	@bash scripts/reasons-lint.sh

## branch-name-check: Check the current branch follows latc-<story>-<slug>
branch-name-check:
	@bash scripts/branch-name-check.sh

## eval: Run the promptfoo evals in labs/ (needs GOOGLE_API_KEY); results in output/
PROMPTFOO ?= npx --yes promptfoo@0.126.0
eval:
	@mkdir -p output
	@rc=0; \
	$(PROMPTFOO) eval -c labs/mine.yaml --no-progress-bar --output output/eval-mine.json || rc=1; \
	$(PROMPTFOO) eval -c labs/calibrate-judge.yaml --no-progress-bar --repeat 3 --output output/eval-calibrate-judge.json || rc=1; \
	node lib/evalSummary.js output/eval-mine.json output/eval-calibrate-judge.json; \
	exit $$rc

## eval-agentic: Run the agentic test-writer eval (slow; needs GOOGLE_API_KEY; not in CI)
# OpenCode is pinned to the SDK's 1.x and gets its own data dirs under output/, so it never
# touches (or trips over) the database of a globally installed OpenCode 2.x.
OC_HOME = $(CURDIR)/output/opencode-home
eval-agentic:
	@mkdir -p "$(OC_HOME)"
	GOOGLE_GENERATIVE_AI_API_KEY="$${GOOGLE_GENERATIVE_AI_API_KEY:-$$GOOGLE_API_KEY}" \
	XDG_DATA_HOME="$(OC_HOME)/data" XDG_STATE_HOME="$(OC_HOME)/state" \
	XDG_CACHE_HOME="$(OC_HOME)/cache" XDG_CONFIG_HOME="$(OC_HOME)/config" \
	npx --yes -p promptfoo@0.126.0 -p @opencode-ai/sdk@1.19.6 -p opencode-ai@1.19.6 \
		promptfoo eval -c labs/agentic.yaml --output output/eval-agentic.json
