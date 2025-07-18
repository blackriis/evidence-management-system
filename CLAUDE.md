# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Evidence Management System for Educational Quality Assessment - a Next.js application designed to manage educational evidence, evaluations, and quality assurance processes. The system supports multiple user roles including teachers, evaluators, executives, and administrators with role-based access control.

## Development Commands

```bash
# Start development server with Turbopack
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Linting and formatting
npm run lint
npm run lint:fix
npm run format
npm run format:check
npm run type-check

# Database operations
npm run db:generate    # Generate Prisma client
npm run db:push        # Push schema to database
npm run db:migrate     # Run migrations
npm run db:studio      # Open Prisma Studio
npm run db:seed        # Seed database
```

## Architecture Overview

### Database Schema (Prisma)
- **Users**: Role-based system with TEACHER, IQA_EVALUATOR, EQA_EVALUATOR, EXECUTIVE, ADMIN roles
- **Academic Years**: Time-based evidence organization with upload/evaluation windows
- **Standards/Indicators/SubIndicators**: Hierarchical structure for evidence categorization
- **Evidence**: File uploads with versioning, soft deletion, and metadata
- **Evaluations**: Qualitative (1-5) and quantitative (0-100) scoring system

### Authentication & Authorization
- NextAuth.js with custom credentials provider
- JWT-based sessions with 24-hour expiration
- Role-based middleware in `src/middleware.ts` with route protection
- Development mode allows any password for existing users
- Role permissions defined in `src/lib/constants.ts`

### Key Components Structure
- `src/app/`: Next.js App Router pages and API routes
- `src/components/auth/`: Authentication components (login, navigation, role guards)
- `src/components/ui/`: Reusable UI components (shadcn/ui based)
- `src/hooks/`: Custom React hooks for authentication and data fetching
- `src/lib/`: Utility functions, database connection, auth configuration

### Environment Variables
Required environment variables are validated using Zod schema in `src/lib/env.ts`:
- Database: `DATABASE_URL`
- Auth: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- Storage: `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET`
- Optional: Email (Resend), Line Notify, Redis

### File Upload System
- 5GB per user per academic year limit
- Supports PDF, Office documents, images, and text files
- Chunked uploads for large files (10MB chunks)
- Versioning with latest file tracking

### Security Features
- CSP headers in middleware
- Input validation with Zod schemas
- Role-based access control with fine-grained permissions
- Soft deletion with 90-day recycle bin retention
- Audit logging for sensitive operations

## Development Notes

### UI Framework
- Tailwind CSS for styling
- shadcn/ui components in `src/components/ui/`
- Radix UI primitives for accessibility
- Lucide React for icons

### State Management
- React Context for authentication state
- Custom hooks for data fetching and auth logic
- Server-side state management with Prisma

### Testing
- TypeScript strict mode enabled
- ESLint with Next.js configuration
- Prettier for code formatting

When working with this codebase, always consider role-based permissions, maintain the audit trail for sensitive operations, and follow the established patterns for authentication and data access.