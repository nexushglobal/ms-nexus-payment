# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a NestJS microservice (`ms-nexus-payment`) that handles payment processing, withdrawals, and integration with Culqi payment gateway. It's part of a larger microservices architecture and communicates via NATS messaging.

## Development Commands

### Setup

```bash
pnpm install
```

### Running the Application

```bash
# Development with watch mode
pnpm run start:dev

# Production mode
pnpm run start:prod

# Debug mode
pnpm run start:debug
```

### Testing

```bash
# Run unit tests
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Run e2e tests
pnpm run test:e2e

# Generate test coverage
pnpm run test:cov

# Run tests in debug mode
pnpm run test:debug

# Run specific test file
pnpm run test -- --testPathPattern=filename
```

### Code Quality

```bash
# Lint and fix code
pnpm run lint

# Format code
pnpm run format

# Build for production
pnpm run build
```

## Architecture

### Core Modules

- **PaymentModule**: Main payment processing logic with multiple payment types and methods
- **CulqiModule**: Integration with Culqi payment gateway (cards, charges, customers, plans, subscriptions)
- **WithdrawalsModule**: Handles point withdrawals and approval workflows
- **ReportsModule**: PDF report generation for withdrawals using PDFMake
- **CommonModule**: Shared utilities, DTOs, and services

### Service Architecture

#### Payment Types

- `MembershipPaymentService`: Processes membership-related payments
- `OrderPaymentService`: Handles order payments
- `PlanUpgradeService`: Manages plan upgrade transactions
- `ReconsumptionService`: Processes reconsumption payments

#### Payment Methods

- `PointsPaymentService`: Processes payments using user points
- `VoucherPaymentService`: Handles voucher-based payments
- `PaymentGatewayService`: Manages external payment gateway integrations

#### Shared Services

- `BonusProcessingService`: Handles direct referral bonus and binary volume points processing (shared across payment types)

### Database

- Uses TypeORM with PostgreSQL
- Main entities: `Payment`, `PaymentItem`, `PaymentConfig`, `Withdrawal`
- Database configuration via environment variables

### Microservice Communication

- Uses NATS for inter-service communication
- Configured as a NestJS microservice (not HTTP server)
- Service identifier interceptor for request tracking

## Environment Configuration

Required environment variables:

- `PAYMENTS_DATABASE_URL`: PostgreSQL connection string
- `NATS_SERVERS`: NATS server connection (default: nats://localhost:4222)
- `PK_CULQUI`: Culqi public key
- `SK_CULQUI`: Culqi secret key
- `NODE_ENV`: Environment (development/production/test)

## Key Patterns

### Validation

- Global validation pipe with whitelist and transform enabled
- Custom validation exception factory for consistent error handling
- Class-validator and class-transformer for DTOs

### Error Handling

- Centralized validation exception factory
- Service identifier interceptor for request tracking

### Payment Processing

- Strategy pattern implemented via `PaymentProcessorService`
- Base payment method service for common functionality
- Separate services for different payment types and methods

## Workflow Preferences

- **Auto-apply changes**: ALWAYS apply changes directly to files using Write/Edit tools without asking for permission
- **Direct updates**: Replace code immediately after making improvements unless explicitly asked to review first
- **No confirmation needed**: Never ask for permission before making code changes, refactoring, or improvements
- **Efficient workflow**: Combine analysis and implementation in single responses when possible
- **Immediate action**: When given a task, implement changes directly without requesting approval