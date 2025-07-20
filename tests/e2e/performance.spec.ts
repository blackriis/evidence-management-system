import { test, expect } from '@playwright/test'

test.describe('Performance Tests', () => {
  test.describe('Concurrent User Scenarios', () => {
    test('should handle multiple simultaneous logins', async ({ browser }) => {
      const concurrentUsers = 10
      const contexts = []
      const pages = []

      try {
        // Create multiple browser contexts
        for (let i = 0; i < concurrentUsers; i++) {
          const context = await browser.newContext()
          const page = await context.newPage()
          contexts.push(context)
          pages.push(page)
        }

        // Perform simultaneous logins
        const loginPromises = pages.map(async (page, index) => {
          const startTime = Date.now()
          
          await page.goto('/login')
          await page.fill('[data-testid="email-input"]', `user${index}@test.university.ac.th`)
          await page.fill('[data-testid="password-input"]', 'TestPassword123!')
          await page.click('[data-testid="login-button"]')
          
          await expect(page.locator('[data-testid="dashboard"]')).toBeVisible({ timeout: 30000 })
          
          const endTime = Date.now()
          return endTime - startTime
        })

        const loginTimes = await Promise.all(loginPromises)

        // Verify all logins succeeded within reasonable time
        loginTimes.forEach((time, index) => {
          expect(time).toBeLessThan(10000) // 10 seconds max
          console.log(`User ${index} login time: ${time}ms`)
        })

        const averageLoginTime = loginTimes.reduce((sum, time) => sum + time, 0) / loginTimes.length
        console.log(`Average login time: ${averageLoginTime}ms`)
        expect(averageLoginTime).toBeLessThan(5000) // 5 seconds average

      } finally {
        // Cleanup
        await Promise.all(contexts.map(context => context.close()))
      }
    })

    test('should handle concurrent evidence uploads', async ({ browser }) => {
      const concurrentUploads = 5
      const contexts = []
      const pages = []

      try {
        // Setup multiple authenticated sessions
        for (let i = 0; i < concurrentUploads; i++) {
          const context = await browser.newContext()
          const page = await context.newPage()
          
          // Login
          await page.goto('/login')
          await page.fill('[data-testid="email-input"]', `faculty${i}@test.university.ac.th`)
          await page.fill('[data-testid="password-input"]', 'TestPassword123!')
          await page.click('[data-testid="login-button"]')
          await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()
          
          contexts.push(context)
          pages.push(page)
        }

        // Perform concurrent uploads
        const uploadPromises = pages.map(async (page, index) => {
          const startTime = Date.now()
          
          await page.click('[data-testid="upload-evidence-button"]')
          await page.fill('[data-testid="evidence-title"]', `Concurrent Upload Test ${index}`)
          await page.fill('[data-testid="evidence-description"]', `Performance test upload ${index}`)
          await page.selectOption('[data-testid="evidence-category"]', 'RESEARCH')
          
          await page.setInputFiles('[data-testid="file-input"]', 'tests/fixtures/test-document.pdf')
          await expect(page.locator('[data-testid="file-validation-success"]')).toBeVisible()
          
          await page.click('[data-testid="submit-evidence-button"]')
          await expect(page.locator('[data-testid="success-message"]')).toBeVisible({ timeout: 30000 })
          
          const endTime = Date.now()
          return endTime - startTime
        })

        const uploadTimes = await Promise.all(uploadPromises)

        // Verify all uploads succeeded
        uploadTimes.forEach((time, index) => {
          expect(time).toBeLessThan(30000) // 30 seconds max
          console.log(`Upload ${index} time: ${time}ms`)
        })

        const averageUploadTime = uploadTimes.reduce((sum, time) => sum + time, 0) / uploadTimes.length
        console.log(`Average upload time: ${averageUploadTime}ms`)

      } finally {
        await Promise.all(contexts.map(context => context.close()))
      }
    })

    test('should handle concurrent evaluations', async ({ browser }) => {
      const concurrentEvaluators = 3
      const contexts = []
      const pages = []

      try {
        // Setup multiple evaluator sessions
        for (let i = 0; i < concurrentEvaluators; i++) {
          const context = await browser.newContext()
          const page = await context.newPage()
          
          await page.goto('/login')
          await page.fill('[data-testid="email-input"]', `evaluator${i}@test.university.ac.th`)
          await page.fill('[data-testid="password-input"]', 'TestPassword123!')
          await page.click('[data-testid="login-button"]')
          await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()
          
          contexts.push(context)
          pages.push(page)
        }

        // Perform concurrent evaluations
        const evaluationPromises = pages.map(async (page, index) => {
          const startTime = Date.now()
          
          await page.click('[data-testid="evaluation-queue-link"]')
          
          // Check if there are items to evaluate
          const evaluationItems = page.locator('[data-testid="evidence-item"]')
          const count = await evaluationItems.count()
          
          if (count > 0) {
            await evaluationItems.first().locator('[data-testid="evaluate-button"]').click()
            await expect(page.locator('[data-testid="evaluation-form"]')).toBeVisible()
            
            await page.fill('[data-testid="evaluation-score"]', '80')
            await page.fill('[data-testid="evaluation-feedback"]', `Concurrent evaluation ${index}`)
            await page.selectOption('[data-testid="evaluation-status"]', 'APPROVED')
            
            await page.click('[data-testid="submit-evaluation-button"]')
            await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
          }
          
          const endTime = Date.now()
          return endTime - startTime
        })

        const evaluationTimes = await Promise.all(evaluationPromises)
        
        evaluationTimes.forEach((time, index) => {
          console.log(`Evaluation ${index} time: ${time}ms`)
        })

      } finally {
        await Promise.all(contexts.map(context => context.close()))
      }
    })
  })

  test.describe('Load Testing', () => {
    test('should maintain performance under heavy page load', async ({ page }) => {
      const iterations = 20
      const loadTimes = []

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now()
        
        await page.goto('/login')
        await page.fill('[data-testid="email-input"]', 'faculty@test.university.ac.th')
        await page.fill('[data-testid="password-input"]', 'TestPassword123!')
        await page.click('[data-testid="login-button"]')
        
        await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()
        
        // Navigate through different pages
        await page.click('[data-testid="my-evidence"]')
        await expect(page.locator('[data-testid="evidence-list"]')).toBeVisible()
        
        await page.click('[data-testid="upload-evidence-button"]')
        await expect(page.locator('[data-testid="upload-form"]')).toBeVisible()
        
        const endTime = Date.now()
        loadTimes.push(endTime - startTime)
        
        // Clear session for next iteration
        await page.context().clearCookies()
      }

      // Analyze performance
      const averageTime = loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length
      const maxTime = Math.max(...loadTimes)
      const minTime = Math.min(...loadTimes)

      console.log(`Load test results:`)
      console.log(`Average time: ${averageTime}ms`)
      console.log(`Max time: ${maxTime}ms`)
      console.log(`Min time: ${minTime}ms`)

      // Performance assertions
      expect(averageTime).toBeLessThan(8000) // 8 seconds average
      expect(maxTime).toBeLessThan(15000) // 15 seconds max
    })

    test('should handle large data sets efficiently', async ({ page }) => {
      // Login as admin to access large data sets
      await page.goto('/login')
      await page.fill('[data-testid="email-input"]', 'admin@test.university.ac.th')
      await page.fill('[data-testid="password-input"]', 'TestPassword123!')
      await page.click('[data-testid="login-button"]')
      
      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()

      // Test large evidence list loading
      const startTime = Date.now()
      
      await page.click('[data-testid="all-evidence-link"]')
      await expect(page.locator('[data-testid="evidence-list"]')).toBeVisible()
      
      // Wait for all evidence items to load
      await page.waitForFunction(() => {
        const items = document.querySelectorAll('[data-testid="evidence-item"]')
        return items.length > 0
      }, { timeout: 30000 })

      const loadTime = Date.now() - startTime
      console.log(`Large data set load time: ${loadTime}ms`)
      
      expect(loadTime).toBeLessThan(10000) // 10 seconds max

      // Test pagination performance
      const paginationStartTime = Date.now()
      
      await page.click('[data-testid="next-page-button"]')
      await expect(page.locator('[data-testid="evidence-list"]')).toBeVisible()
      
      const paginationTime = Date.now() - paginationStartTime
      console.log(`Pagination time: ${paginationTime}ms`)
      
      expect(paginationTime).toBeLessThan(3000) // 3 seconds max
    })

    test('should handle search and filtering efficiently', async ({ page }) => {
      await page.goto('/login')
      await page.fill('[data-testid="email-input"]', 'admin@test.university.ac.th')
      await page.fill('[data-testid="password-input"]', 'TestPassword123!')
      await page.click('[data-testid="login-button"]')
      
      await page.click('[data-testid="all-evidence-link"]')
      await expect(page.locator('[data-testid="evidence-list"]')).toBeVisible()

      // Test search performance
      const searchStartTime = Date.now()
      
      await page.fill('[data-testid="search-input"]', 'research')
      await page.click('[data-testid="search-button"]')
      
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible()
      
      const searchTime = Date.now() - searchStartTime
      console.log(`Search time: ${searchTime}ms`)
      
      expect(searchTime).toBeLessThan(5000) // 5 seconds max

      // Test filter performance
      const filterStartTime = Date.now()
      
      await page.selectOption('[data-testid="category-filter"]', 'RESEARCH')
      await page.selectOption('[data-testid="status-filter"]', 'APPROVED')
      await page.click('[data-testid="apply-filters-button"]')
      
      await expect(page.locator('[data-testid="filtered-results"]')).toBeVisible()
      
      const filterTime = Date.now() - filterStartTime
      console.log(`Filter time: ${filterTime}ms`)
      
      expect(filterTime).toBeLessThan(3000) // 3 seconds max
    })
  })

  test.describe('Memory and Resource Usage', () => {
    test('should not have memory leaks during extended usage', async ({ page }) => {
      // Monitor memory usage during extended session
      await page.goto('/login')
      await page.fill('[data-testid="email-input"]', 'faculty@test.university.ac.th')
      await page.fill('[data-testid="password-input"]', 'TestPassword123!')
      await page.click('[data-testid="login-button"]')

      // Simulate extended usage
      for (let i = 0; i < 10; i++) {
        // Navigate through different pages
        await page.click('[data-testid="my-evidence"]')
        await expect(page.locator('[data-testid="evidence-list"]')).toBeVisible()
        
        await page.click('[data-testid="upload-evidence-button"]')
        await expect(page.locator('[data-testid="upload-form"]')).toBeVisible()
        
        await page.click('[data-testid="dashboard-link"]')
        await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()
        
        // Check for JavaScript errors
        const errors = []
        page.on('pageerror', error => errors.push(error))
        
        expect(errors.length).toBe(0)
      }

      // Verify page is still responsive
      await page.click('[data-testid="my-evidence"]')
      await expect(page.locator('[data-testid="evidence-list"]')).toBeVisible({ timeout: 5000 })
    })

    test('should handle large file uploads without timeout', async ({ page }) => {
      await page.goto('/login')
      await page.fill('[data-testid="email-input"]', 'faculty@test.university.ac.th')
      await page.fill('[data-testid="password-input"]', 'TestPassword123!')
      await page.click('[data-testid="login-button"]')
      
      await page.click('[data-testid="upload-evidence-button"]')
      
      await page.fill('[data-testid="evidence-title"]', 'Large File Test')
      await page.fill('[data-testid="evidence-description"]', 'Testing large file upload performance')
      
      // Upload large file (if available)
      const largeFilePath = 'tests/fixtures/large-document.pdf'
      await page.setInputFiles('[data-testid="file-input"]', largeFilePath)
      
      // Monitor upload progress
      await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible()
      
      // Wait for upload completion with extended timeout
      await expect(page.locator('[data-testid="file-validation-success"]')).toBeVisible({ timeout: 120000 })
      
      await page.click('[data-testid="submit-evidence-button"]')
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible({ timeout: 60000 })
    })
  })
})