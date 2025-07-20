import { test, expect } from '@playwright/test'
import path from 'path'

test.describe('Evidence Upload Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as faculty member
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'faculty@test.university.ac.th')
    await page.fill('[data-testid="password-input"]', 'TestPassword123!')
    await page.click('[data-testid="login-button"]')
    
    // Wait for dashboard to load
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()
  })

  test('should upload evidence successfully', async ({ page }) => {
    // Navigate to evidence upload page
    await page.click('[data-testid="upload-evidence-button"]')
    await expect(page.locator('[data-testid="upload-form"]')).toBeVisible()

    // Fill in evidence details
    await page.fill('[data-testid="evidence-title"]', 'E2E Test Research Paper')
    await page.fill('[data-testid="evidence-description"]', 'This is a test research paper for E2E testing')
    await page.selectOption('[data-testid="evidence-category"]', 'RESEARCH')

    // Upload file
    const testFilePath = path.join(__dirname, '../fixtures/test-document.pdf')
    await page.setInputFiles('[data-testid="file-input"]', testFilePath)

    // Wait for file validation
    await expect(page.locator('[data-testid="file-validation-success"]')).toBeVisible()

    // Submit form
    await page.click('[data-testid="submit-evidence-button"]')

    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Evidence uploaded successfully')

    // Verify redirect to evidence list
    await expect(page.url()).toContain('/evidence')
    
    // Verify evidence appears in list
    await expect(page.locator('[data-testid="evidence-item"]').first()).toContainText('E2E Test Research Paper')
  })

  test('should validate file types and reject invalid files', async ({ page }) => {
    await page.click('[data-testid="upload-evidence-button"]')
    
    // Try to upload invalid file type
    const invalidFilePath = path.join(__dirname, '../fixtures/invalid-file.exe')
    await page.setInputFiles('[data-testid="file-input"]', invalidFilePath)

    // Verify error message
    await expect(page.locator('[data-testid="file-validation-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="file-validation-error"]')).toContainText('Invalid file type')

    // Verify submit button is disabled
    await expect(page.locator('[data-testid="submit-evidence-button"]')).toBeDisabled()
  })

  test('should handle large file uploads with progress indicator', async ({ page }) => {
    await page.click('[data-testid="upload-evidence-button"]')
    
    await page.fill('[data-testid="evidence-title"]', 'Large File Test')
    await page.fill('[data-testid="evidence-description"]', 'Testing large file upload')
    
    // Upload large file
    const largeFilePath = path.join(__dirname, '../fixtures/large-document.pdf')
    await page.setInputFiles('[data-testid="file-input"]', largeFilePath)

    // Verify progress indicator appears
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible()
    
    // Wait for upload completion
    await expect(page.locator('[data-testid="file-validation-success"]')).toBeVisible({ timeout: 60000 })
    
    await page.click('[data-testid="submit-evidence-button"]')
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible({ timeout: 30000 })
  })

  test('should allow editing evidence before submission', async ({ page }) => {
    await page.click('[data-testid="upload-evidence-button"]')
    
    // Fill initial data
    await page.fill('[data-testid="evidence-title"]', 'Initial Title')
    await page.fill('[data-testid="evidence-description"]', 'Initial description')
    
    // Edit the data
    await page.fill('[data-testid="evidence-title"]', 'Updated Title')
    await page.fill('[data-testid="evidence-description"]', 'Updated description with more details')
    
    const testFilePath = path.join(__dirname, '../fixtures/test-document.pdf')
    await page.setInputFiles('[data-testid="file-input"]', testFilePath)
    
    await expect(page.locator('[data-testid="file-validation-success"]')).toBeVisible()
    await page.click('[data-testid="submit-evidence-button"]')
    
    // Verify updated data is saved
    await expect(page.locator('[data-testid="evidence-item"]').first()).toContainText('Updated Title')
  })

  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate network failure
    await page.route('/api/evidence/upload', route => {
      route.abort('failed')
    })

    await page.click('[data-testid="upload-evidence-button"]')
    await page.fill('[data-testid="evidence-title"]', 'Network Error Test')
    await page.fill('[data-testid="evidence-description"]', 'Testing network error handling')
    
    const testFilePath = path.join(__dirname, '../fixtures/test-document.pdf')
    await page.setInputFiles('[data-testid="file-input"]', testFilePath)
    
    await expect(page.locator('[data-testid="file-validation-success"]')).toBeVisible()
    await page.click('[data-testid="submit-evidence-button"]')

    // Verify error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Upload failed')
    
    // Verify retry option is available
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
  })

  test('should maintain form data on page refresh', async ({ page }) => {
    await page.click('[data-testid="upload-evidence-button"]')
    
    // Fill form data
    await page.fill('[data-testid="evidence-title"]', 'Persistent Form Data')
    await page.fill('[data-testid="evidence-description"]', 'This data should persist')
    await page.selectOption('[data-testid="evidence-category"]', 'TEACHING')
    
    // Refresh page
    await page.reload()
    
    // Verify form data is restored (if implemented with localStorage)
    // This test assumes the application implements form persistence
    await expect(page.locator('[data-testid="evidence-title"]')).toHaveValue('Persistent Form Data')
    await expect(page.locator('[data-testid="evidence-description"]')).toHaveValue('This data should persist')
  })
})