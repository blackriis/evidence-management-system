import { chromium, FullConfig } from '@playwright/test'

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E test cleanup...')

  // Launch browser for cleanup
  const browser = await chromium.launch()
  const page = await browser.newPage()

  try {
    // Navigate to application
    await page.goto('http://localhost:3000')

    // Clean up test data
    console.log('🗑️ Cleaning up test data...')
    
    // Remove test users and data
    const response = await page.request.post('/api/test/cleanup', {
      data: {
        action: 'cleanup-test-data',
        cleanupTypes: [
          'test-users',
          'test-evidence',
          'test-evaluations',
          'test-academic-years',
          'test-audit-logs',
        ],
      },
    })

    if (!response.ok()) {
      console.warn('⚠️ Test data cleanup failed, manual cleanup may be required')
    }

    // Clean up uploaded test files
    await page.request.post('/api/test/cleanup', {
      data: {
        action: 'cleanup-test-files',
        filePatterns: [
          'test-*',
          'e2e-*',
          'playwright-*',
        ],
      },
    })

    console.log('✅ E2E test cleanup completed successfully')
  } catch (error) {
    console.error('❌ E2E test cleanup failed:', error)
    // Don't throw error in teardown to avoid masking test failures
  } finally {
    await browser.close()
  }
}

export default globalTeardown