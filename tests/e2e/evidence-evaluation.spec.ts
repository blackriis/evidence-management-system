import { test, expect } from '@playwright/test'

test.describe('Evidence Evaluation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as evaluator
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'evaluator@test.university.ac.th')
    await page.fill('[data-testid="password-input"]', 'TestPassword123!')
    await page.click('[data-testid="login-button"]')
    
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()
  })

  test('should evaluate evidence successfully', async ({ page }) => {
    // Navigate to evaluation queue
    await page.click('[data-testid="evaluation-queue-link"]')
    await expect(page.locator('[data-testid="evaluation-queue"]')).toBeVisible()

    // Select first evidence for evaluation
    await page.click('[data-testid="evidence-item"]:first-child [data-testid="evaluate-button"]')
    await expect(page.locator('[data-testid="evaluation-form"]')).toBeVisible()

    // Review evidence details
    await expect(page.locator('[data-testid="evidence-title"]')).toBeVisible()
    await expect(page.locator('[data-testid="evidence-description"]')).toBeVisible()
    
    // Download and review file
    await page.click('[data-testid="download-evidence-button"]')
    // Note: File download verification would require additional setup

    // Fill evaluation form
    await page.fill('[data-testid="evaluation-score"]', '85')
    await page.fill('[data-testid="evaluation-feedback"]', 'Excellent research work with comprehensive analysis. Well-structured and clearly presented.')
    await page.selectOption('[data-testid="evaluation-status"]', 'APPROVED')

    // Add detailed criteria scores
    await page.fill('[data-testid="criteria-quality"]', '90')
    await page.fill('[data-testid="criteria-relevance"]', '85')
    await page.fill('[data-testid="criteria-innovation"]', '80')
    await page.fill('[data-testid="criteria-impact"]', '85')

    // Submit evaluation
    await page.click('[data-testid="submit-evaluation-button"]')

    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Evaluation submitted successfully')

    // Verify redirect back to queue
    await expect(page.url()).toContain('/evaluation')
    
    // Verify evidence is no longer in pending queue
    await expect(page.locator('[data-testid="evaluation-queue"]')).not.toContainText('Excellent research work')
  })

  test('should reject evidence with detailed feedback', async ({ page }) => {
    await page.click('[data-testid="evaluation-queue-link"]')
    await page.click('[data-testid="evidence-item"]:first-child [data-testid="evaluate-button"]')

    // Fill rejection evaluation
    await page.fill('[data-testid="evaluation-score"]', '45')
    await page.fill('[data-testid="evaluation-feedback"]', 'The evidence lacks sufficient detail and supporting documentation. Please provide more comprehensive analysis and references.')
    await page.selectOption('[data-testid="evaluation-status"]', 'REJECTED')

    // Add specific improvement suggestions
    await page.fill('[data-testid="improvement-suggestions"]', 'Please include: 1) More detailed methodology, 2) Additional references, 3) Clearer conclusions')

    await page.click('[data-testid="submit-evaluation-button"]')

    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
  })

  test('should request revisions for evidence', async ({ page }) => {
    await page.click('[data-testid="evaluation-queue-link"]')
    await page.click('[data-testid="evidence-item"]:first-child [data-testid="evaluate-button"]')

    // Fill revision request
    await page.fill('[data-testid="evaluation-score"]', '65')
    await page.fill('[data-testid="evaluation-feedback"]', 'Good foundation but needs minor revisions to meet standards.')
    await page.selectOption('[data-testid="evaluation-status"]', 'REVISION_REQUIRED')

    // Specify required revisions
    await page.fill('[data-testid="revision-requirements"]', 'Please address the following: 1) Clarify methodology section, 2) Add missing citations, 3) Improve conclusion')
    await page.fill('[data-testid="revision-deadline"]', '2024-12-31')

    await page.click('[data-testid="submit-evaluation-button"]')

    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
  })

  test('should handle bulk evaluation actions', async ({ page }) => {
    await page.click('[data-testid="evaluation-queue-link"]')

    // Select multiple evidence items
    await page.check('[data-testid="evidence-item"]:nth-child(1) [data-testid="select-checkbox"]')
    await page.check('[data-testid="evidence-item"]:nth-child(2) [data-testid="select-checkbox"]')
    await page.check('[data-testid="evidence-item"]:nth-child(3) [data-testid="select-checkbox"]')

    // Verify bulk actions are available
    await expect(page.locator('[data-testid="bulk-actions"]')).toBeVisible()

    // Assign to evaluator
    await page.click('[data-testid="bulk-assign-button"]')
    await page.selectOption('[data-testid="evaluator-select"]', 'evaluator@test.university.ac.th')
    await page.click('[data-testid="confirm-assignment-button"]')

    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="success-message"]')).toContainText('3 evidence items assigned')
  })

  test('should filter and search evaluation queue', async ({ page }) => {
    await page.click('[data-testid="evaluation-queue-link"]')

    // Test search functionality
    await page.fill('[data-testid="search-input"]', 'research')
    await page.click('[data-testid="search-button"]')

    // Verify filtered results
    await expect(page.locator('[data-testid="evidence-item"]')).toContainText('research')

    // Test category filter
    await page.selectOption('[data-testid="category-filter"]', 'RESEARCH')
    await page.click('[data-testid="apply-filters-button"]')

    // Test status filter
    await page.selectOption('[data-testid="status-filter"]', 'PENDING')
    await page.click('[data-testid="apply-filters-button"]')

    // Test date range filter
    await page.fill('[data-testid="date-from"]', '2024-01-01')
    await page.fill('[data-testid="date-to"]', '2024-12-31')
    await page.click('[data-testid="apply-filters-button"]')

    // Clear filters
    await page.click('[data-testid="clear-filters-button"]')
    await expect(page.locator('[data-testid="search-input"]')).toHaveValue('')
  })

  test('should handle evaluation conflicts and reassignment', async ({ page }) => {
    await page.click('[data-testid="evaluation-queue-link"]')
    
    // Simulate conflict scenario
    await page.click('[data-testid="evidence-item"]:first-child [data-testid="evaluate-button"]')
    
    // Check for conflict warning (if evidence is already being evaluated)
    const conflictWarning = page.locator('[data-testid="conflict-warning"]')
    if (await conflictWarning.isVisible()) {
      // Handle conflict resolution
      await page.click('[data-testid="take-over-evaluation"]')
      await expect(page.locator('[data-testid="evaluation-form"]')).toBeVisible()
    }

    // Complete evaluation
    await page.fill('[data-testid="evaluation-score"]', '75')
    await page.fill('[data-testid="evaluation-feedback"]', 'Satisfactory work with room for improvement')
    await page.selectOption('[data-testid="evaluation-status"]', 'APPROVED')
    
    await page.click('[data-testid="submit-evaluation-button"]')
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
  })

  test('should export evaluation reports', async ({ page }) => {
    await page.click('[data-testid="evaluation-queue-link"]')
    
    // Navigate to completed evaluations
    await page.click('[data-testid="completed-evaluations-tab"]')
    
    // Select evaluation period
    await page.fill('[data-testid="report-date-from"]', '2024-01-01')
    await page.fill('[data-testid="report-date-to"]', '2024-12-31')
    
    // Generate report
    await page.click('[data-testid="generate-report-button"]')
    
    // Wait for report generation
    await expect(page.locator('[data-testid="report-ready"]')).toBeVisible({ timeout: 30000 })
    
    // Download report
    const downloadPromise = page.waitForEvent('download')
    await page.click('[data-testid="download-report-button"]')
    const download = await downloadPromise
    
    // Verify download
    expect(download.suggestedFilename()).toContain('evaluation-report')
    expect(download.suggestedFilename()).toContain('.pdf')
  })

  test('should handle evaluation deadline notifications', async ({ page }) => {
    await page.click('[data-testid="evaluation-queue-link"]')
    
    // Check for deadline notifications
    const deadlineNotification = page.locator('[data-testid="deadline-notification"]')
    if (await deadlineNotification.isVisible()) {
      await expect(deadlineNotification).toContainText('deadline approaching')
      
      // Click on urgent evaluation
      await page.click('[data-testid="urgent-evaluation-link"]')
      await expect(page.locator('[data-testid="evaluation-form"]')).toBeVisible()
      
      // Verify deadline warning in form
      await expect(page.locator('[data-testid="deadline-warning"]')).toBeVisible()
    }
  })
})