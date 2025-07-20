import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test setup...')

  // Launch browser for setup
  const browser = await chromium.launch()
  const page = await browser.newPage()

  try {
    // Wait for the application to be ready
    console.log('⏳ Waiting for application to be ready...')
    await page.goto('http://localhost:3000')
    await page.waitForSelector('body', { timeout: 30000 })

    // Setup test data if needed
    console.log('📊 Setting up test data...')
    
    // Create test users via API or database seeding
    // This would typically involve calling your seed script or API endpoints
    
    // Example: Create admin user for tests
    const response = await page.request.post('/api/test/setup', {
      data: {
        action: 'create-test-users',
        users: [
          {
            email: 'admin@test.university.ac.th',
            name: 'Test Admin',
            role: 'ADMIN',
            password: 'TestPassword123!',
          },
          {
            email: 'faculty@test.university.ac.th',
            name: 'Test Faculty',
            role: 'FACULTY',
            department: 'Computer Science',
            password: 'TestPassword123!',
          },
          {
            email: 'evaluator@test.university.ac.th',
            name: 'Test Evaluator',
            role: 'EVALUATOR',
            department: 'Computer Science',
            password: 'TestPassword123!',
          },
        ],
      },
    })

    if (!response.ok()) {
      console.warn('⚠️ Test user setup failed, tests may use existing data')
    }

    // Setup academic year for testing
    await page.request.post('/api/test/setup', {
      data: {
        action: 'create-academic-year',
        year: '2024',
        isActive: true,
        submissionStart: new Date('2024-01-01').toISOString(),
        submissionEnd: new Date('2024-12-31').toISOString(),
        evaluationStart: new Date('2024-06-01').toISOString(),
        evaluationEnd: new Date('2024-07-31').toISOString(),
      },
    })

    console.log('✅ E2E test setup completed successfully')
  } catch (error) {
    console.error('❌ E2E test setup failed:', error)
    throw error
  } finally {
    await browser.close()
  }
}

export default globalSetup