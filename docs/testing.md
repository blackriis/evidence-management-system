# Testing Documentation

## Overview

This document describes the comprehensive testing strategy for the Evidence Management System, including unit tests, integration tests, and end-to-end (E2E) tests.

## Test Structure

```
evidence-management-system/
├── src/
│   ├── __tests__/
│   │   └── integration/          # Integration tests
│   ├── lib/__tests__/            # Unit tests for utilities
│   └── services/__tests__/       # Unit tests for services
├── tests/
│   ├── e2e/                      # End-to-end tests
│   └── fixtures/                 # Test data and files
├── jest.config.js                # Jest configuration
├── jest.setup.js                 # Jest setup file
└── playwright.config.ts          # Playwright configuration
```

## Test Types

### 1. Unit Tests

Unit tests focus on testing individual functions and components in isolation.

**Location**: `src/**/__tests__/`

**Technologies**: Jest, React Testing Library

**Coverage**:
- Service layer functions
- Utility functions
- Business logic
- Component behavior
- Error handling

**Running Unit Tests**:
```bash
npm run test              # Run all unit tests
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Run tests with coverage report
```

### 2. Integration Tests

Integration tests verify the interaction between different system components.

**Location**: `src/__tests__/integration/`

**Coverage**:
- Database operations
- File storage operations
- API endpoint interactions
- Service integrations
- Complex workflows

**Running Integration Tests**:
```bash
npm run test:integration
```

### 3. End-to-End (E2E) Tests

E2E tests simulate real user interactions with the complete application.

**Location**: `tests/e2e/`

**Technology**: Playwright

**Coverage**:
- Critical user workflows
- Role-based access control
- Cross-browser compatibility
- Performance scenarios
- Error handling

**Running E2E Tests**:
```bash
npm run test:e2e          # Run all E2E tests
npm run test:e2e:ui       # Run tests with UI mode
```

## Test Scenarios

### Evidence Upload Workflow
- ✅ Successful file upload with validation
- ✅ File type validation and rejection
- ✅ Large file upload with progress tracking
- ✅ Form data persistence
- ✅ Network error handling

### Evidence Evaluation Workflow
- ✅ Complete evaluation process
- ✅ Evidence approval/rejection
- ✅ Revision requests
- ✅ Bulk evaluation actions
- ✅ Search and filtering

### Role-Based Access Control
- ✅ Admin access to all features
- ✅ Faculty access restrictions
- ✅ Evaluator access limitations
- ✅ Cross-role security validation
- ✅ Department-based access control

### Performance Testing
- ✅ Concurrent user scenarios
- ✅ Load testing under heavy usage
- ✅ Large dataset handling
- ✅ Memory leak detection
- ✅ Resource usage monitoring

## Test Data Management

### Test Users
The system creates test users for different roles:
- `admin@test.university.ac.th` - Admin user
- `faculty@test.university.ac.th` - Faculty member
- `evaluator@test.university.ac.th` - Evaluator

### Test Files
Located in `tests/fixtures/`:
- `test-document.pdf` - Standard test document
- `large-document.pdf` - Large file for performance testing
- `invalid-file.exe` - Invalid file type for validation testing

### Database Seeding
Test data is automatically created and cleaned up:
- Academic years
- Sample evidence
- Evaluation records
- Audit logs

## Continuous Integration

### GitHub Actions Workflows

**Unit & Integration Tests** (`.github/workflows/tests.yml`):
- Runs on every push and pull request
- Sets up PostgreSQL and Redis services
- Executes all unit and integration tests
- Generates coverage reports

**E2E Tests**:
- Runs Playwright tests across multiple browsers
- Tests critical user workflows
- Generates test reports and screenshots

**Performance Tests**:
- Runs on main branch pushes
- Monitors application performance
- Generates performance metrics

**Security Tests**:
- Dependency vulnerability scanning
- Static code analysis
- Security audit checks

## Test Configuration

### Jest Configuration (`jest.config.js`)
- Next.js integration
- TypeScript support
- Coverage thresholds (70% minimum)
- Test environment setup

### Playwright Configuration (`playwright.config.ts`)
- Multi-browser testing (Chrome, Firefox, Safari)
- Mobile device testing
- Parallel test execution
- Screenshot and video recording on failures

## Best Practices

### Writing Tests
1. **Descriptive Test Names**: Use clear, descriptive test names
2. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification
3. **Test Isolation**: Each test should be independent
4. **Mock External Dependencies**: Use mocks for external services
5. **Test Edge Cases**: Include error scenarios and boundary conditions

### Test Data
1. **Use Fixtures**: Store test data in fixture files
2. **Clean Setup/Teardown**: Ensure tests clean up after themselves
3. **Realistic Data**: Use data that resembles production scenarios
4. **Avoid Hard-coding**: Use variables for test data

### Performance Testing
1. **Baseline Metrics**: Establish performance baselines
2. **Realistic Load**: Test with realistic user loads
3. **Monitor Resources**: Track memory and CPU usage
4. **Gradual Load Increase**: Incrementally increase test load

## Troubleshooting

### Common Issues

**Test Timeouts**:
- Increase timeout values for slow operations
- Check for infinite loops or hanging promises
- Verify external service availability

**Database Connection Issues**:
- Ensure test database is running
- Check connection string configuration
- Verify database permissions

**File Upload Tests**:
- Ensure test files exist in fixtures directory
- Check file permissions
- Verify S3 mock configuration

**Flaky Tests**:
- Add proper wait conditions
- Use deterministic test data
- Avoid time-dependent assertions

### Debugging Tests

**Unit Tests**:
```bash
npm run test -- --verbose
npm run test -- --detectOpenHandles
```

**E2E Tests**:
```bash
npm run test:e2e -- --debug
npm run test:e2e -- --headed
```

## Coverage Reports

Test coverage reports are generated automatically and include:
- Line coverage
- Branch coverage
- Function coverage
- Statement coverage

**Viewing Coverage**:
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## Maintenance

### Regular Tasks
1. **Update Test Data**: Keep test data current with schema changes
2. **Review Flaky Tests**: Identify and fix unstable tests
3. **Performance Baselines**: Update performance expectations
4. **Security Updates**: Keep testing dependencies updated

### Test Review Process
1. **Code Review**: All test code should be reviewed
2. **Coverage Analysis**: Monitor coverage trends
3. **Performance Monitoring**: Track test execution times
4. **Failure Analysis**: Investigate and fix test failures promptly

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)