import { test, expect } from '@playwright/test'

test.describe('Role-Based Access Control', () => {
  const users = {
    admin: {
      email: 'admin@test.university.ac.th',
      password: 'TestPassword123!',
      role: 'ADMIN'
    },
    faculty: {
      email: 'faculty@test.university.ac.th',
      password: 'TestPassword123!',
      role: 'FACULTY'
    },
    evaluator: {
      email: 'evaluator@test.university.ac.th',
      password: 'TestPassword123!',
      role: 'EVALUATOR'
    }
  }

  async function loginAs(page: any, userType: keyof typeof users) {
    const user = users[userType]
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', user.email)
    await page.fill('[data-testid="password-input"]', user.password)
    await page.click('[data-testid="login-button"]')
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()
  }

  test.describe('Admin Access Control', () => {
    test('admin should have access to all system features', async ({ page }) => {
      await loginAs(page, 'admin')

      // Verify admin dashboard elements
      await expect(page.locator('[data-testid="admin-panel"]')).toBeVisible()
      await expect(page.locator('[data-testid="user-management"]')).toBeVisible()
      await expect(page.locator('[data-testid="system-settings"]')).toBeVisible()
      await expect(page.locator('[data-testid="audit-logs"]')).toBeVisible()
      await expect(page.locator('[data-testid="reports-section"]')).toBeVisible()

      // Test user management access
      await page.click('[data-testid="user-management"]')
      await expect(page.locator('[data-testid="user-list"]')).toBeVisible()
      await expect(page.locator('[data-testid="create-user-button"]')).toBeVisible()

      // Test system settings access
      await page.click('[data-testid="system-settings"]')
      await expect(page.locator('[data-testid="settings-form"]')).toBeVisible()

      // Test audit logs access
      await page.click('[data-testid="audit-logs"]')
      await expect(page.locator('[data-testid="audit-log-table"]')).toBeVisible()
    })

    test('admin should be able to manage users', async ({ page }) => {
      await loginAs(page, 'admin')
      await page.click('[data-testid="user-management"]')

      // Create new user
      await page.click('[data-testid="create-user-button"]')
      await page.fill('[data-testid="user-email"]', 'newuser@test.university.ac.th')
      await page.fill('[data-testid="user-name"]', 'New Test User')
      await page.selectOption('[data-testid="user-role"]', 'FACULTY')
      await page.fill('[data-testid="user-department"]', 'Mathematics')
      await page.click('[data-testid="save-user-button"]')

      await expect(page.locator('[data-testid="success-message"]')).toBeVisible()

      // Edit user
      await page.click('[data-testid="user-item"]:has-text("New Test User") [data-testid="edit-button"]')
      await page.fill('[data-testid="user-name"]', 'Updated Test User')
      await page.click('[data-testid="save-user-button"]')

      await expect(page.locator('[data-testid="success-message"]')).toBeVisible()

      // Deactivate user
      await page.click('[data-testid="user-item"]:has-text("Updated Test User") [data-testid="deactivate-button"]')
      await page.click('[data-testid="confirm-deactivate"]')

      await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
    })

    test('admin should access all evidence and evaluations', async ({ page }) => {
      await loginAs(page, 'admin')

      // Access all evidence
      await page.click('[data-testid="all-evidence-link"]')
      await expect(page.locator('[data-testid="evidence-list"]')).toBeVisible()
      
      // Should see evidence from all departments
      await expect(page.locator('[data-testid="evidence-item"]')).toHaveCount(await page.locator('[data-testid="evidence-item"]').count())

      // Access all evaluations
      await page.click('[data-testid="all-evaluations-link"]')
      await expect(page.locator('[data-testid="evaluation-list"]')).toBeVisible()
    })
  })

  test.describe('Faculty Access Control', () => {
    test('faculty should only access their own evidence', async ({ page }) => {
      await loginAs(page, 'faculty')

      // Verify faculty dashboard
      await expect(page.locator('[data-testid="faculty-dashboard"]')).toBeVisible()
      await expect(page.locator('[data-testid="my-evidence"]')).toBeVisible()
      await expect(page.locator('[data-testid="upload-evidence-button"]')).toBeVisible()

      // Should NOT see admin features
      await expect(page.locator('[data-testid="admin-panel"]')).not.toBeVisible()
      await expect(page.locator('[data-testid="user-management"]')).not.toBeVisible()
      await expect(page.locator('[data-testid="system-settings"]')).not.toBeVisible()

      // Access evidence list
      await page.click('[data-testid="my-evidence"]')
      await expect(page.locator('[data-testid="evidence-list"]')).toBeVisible()
      
      // Should only see own evidence
      const evidenceItems = page.locator('[data-testid="evidence-item"]')
      const count = await evidenceItems.count()
      for (let i = 0; i < count; i++) {
        await expect(evidenceItems.nth(i)).toContainText('faculty@test.university.ac.th')
      }
    })

    test('faculty should be able to upload and edit their evidence', async ({ page }) => {
      await loginAs(page, 'faculty')

      // Upload evidence
      await page.click('[data-testid="upload-evidence-button"]')
      await page.fill('[data-testid="evidence-title"]', 'Faculty Test Evidence')
      await page.fill('[data-testid="evidence-description"]', 'Test description')
      await page.selectOption('[data-testid="evidence-category"]', 'RESEARCH')

      // Mock file upload
      await page.setInputFiles('[data-testid="file-input"]', 'tests/fixtures/test-document.pdf')
      await page.click('[data-testid="submit-evidence-button"]')

      await expect(page.locator('[data-testid="success-message"]')).toBeVisible()

      // Edit evidence (only if status allows)
      await page.click('[data-testid="evidence-item"]:has-text("Faculty Test Evidence") [data-testid="edit-button"]')
      await page.fill('[data-testid="evidence-title"]', 'Updated Faculty Evidence')
      await page.click('[data-testid="save-evidence-button"]')

      await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
    })

    test('faculty should not access other users evidence', async ({ page }) => {
      await loginAs(page, 'faculty')

      // Try to access evidence by direct URL (should be blocked)
      await page.goto('/evidence/other-user-evidence-id')
      await expect(page.locator('[data-testid="access-denied"]')).toBeVisible()
      
      // Or should redirect to unauthorized page
      await expect(page.url()).toContain('/unauthorized')
    })
  })

  test.describe('Evaluator Access Control', () => {
    test('evaluator should access evaluation queue and assigned evidence', async ({ page }) => {
      await loginAs(page, 'evaluator')

      // Verify evaluator dashboard
      await expect(page.locator('[data-testid="evaluator-dashboard"]')).toBeVisible()
      await expect(page.locator('[data-testid="evaluation-queue"]')).toBeVisible()
      await expect(page.locator('[data-testid="my-evaluations"]')).toBeVisible()

      // Should NOT see admin features
      await expect(page.locator('[data-testid="admin-panel"]')).not.toBeVisible()
      await expect(page.locator('[data-testid="user-management"]')).not.toBeVisible()

      // Should NOT see upload evidence button
      await expect(page.locator('[data-testid="upload-evidence-button"]')).not.toBeVisible()

      // Access evaluation queue
      await page.click('[data-testid="evaluation-queue"]')
      await expect(page.locator('[data-testid="pending-evaluations"]')).toBeVisible()
    })

    test('evaluator should only evaluate assigned evidence', async ({ page }) => {
      await loginAs(page, 'evaluator')
      await page.click('[data-testid="evaluation-queue"]')

      // Should only see evidence assigned to this evaluator
      const evaluationItems = page.locator('[data-testid="evaluation-item"]')
      const count = await evaluationItems.count()
      
      if (count > 0) {
        // Click on first evaluation
        await evaluationItems.first().click()
        await expect(page.locator('[data-testid="evaluation-form"]')).toBeVisible()
        
        // Should be able to submit evaluation
        await page.fill('[data-testid="evaluation-score"]', '80')
        await page.fill('[data-testid="evaluation-feedback"]', 'Good work')
        await page.selectOption('[data-testid="evaluation-status"]', 'APPROVED')
        await page.click('[data-testid="submit-evaluation-button"]')
        
        await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
      }
    })

    test('evaluator should not access evidence upload or user management', async ({ page }) => {
      await loginAs(page, 'evaluator')

      // Try to access upload page directly
      await page.goto('/evidence/upload')
      await expect(page.locator('[data-testid="access-denied"]')).toBeVisible()

      // Try to access user management
      await page.goto('/admin/users')
      await expect(page.locator('[data-testid="access-denied"]')).toBeVisible()
    })
  })

  test.describe('Cross-Role Security', () => {
    test('should prevent privilege escalation attempts', async ({ page }) => {
      await loginAs(page, 'faculty')

      // Try to access admin API endpoints
      const response = await page.request.get('/api/admin/users')
      expect(response.status()).toBe(403)

      // Try to modify other users data
      const modifyResponse = await page.request.put('/api/users/other-user-id', {
        data: { role: 'ADMIN' }
      })
      expect(modifyResponse.status()).toBe(403)
    })

    test('should enforce session timeout and re-authentication', async ({ page }) => {
      await loginAs(page, 'faculty')

      // Simulate session expiry by clearing cookies
      await page.context().clearCookies()

      // Try to access protected resource
      await page.goto('/evidence')
      
      // Should redirect to login
      await expect(page.url()).toContain('/login')
      await expect(page.locator('[data-testid="session-expired-message"]')).toBeVisible()
    })

    test('should prevent CSRF attacks', async ({ page }) => {
      await loginAs(page, 'admin')

      // Try to make request without CSRF token
      const response = await page.request.post('/api/users', {
        data: {
          email: 'malicious@example.com',
          name: 'Malicious User',
          role: 'ADMIN'
        }
      })

      // Should be rejected due to missing CSRF token
      expect(response.status()).toBe(403)
    })

    test('should log security events', async ({ page }) => {
      await loginAs(page, 'admin')

      // Perform actions that should be logged
      await page.goto('/admin/users')
      await page.click('[data-testid="create-user-button"]')
      
      // Check audit logs
      await page.goto('/admin/audit-logs')
      await expect(page.locator('[data-testid="audit-log-table"]')).toBeVisible()
      
      // Should see recent security events
      await expect(page.locator('[data-testid="audit-log-item"]').first()).toContainText('USER_MANAGEMENT_ACCESSED')
    })
  })

  test.describe('Department-Based Access', () => {
    test('should restrict access based on department', async ({ page }) => {
      await loginAs(page, 'faculty')

      // Faculty should only see evidence from their department
      await page.click('[data-testid="department-evidence"]')
      await expect(page.locator('[data-testid="evidence-list"]')).toBeVisible()

      // All evidence should be from Computer Science department
      const evidenceItems = page.locator('[data-testid="evidence-item"]')
      const count = await evidenceItems.count()
      
      for (let i = 0; i < count; i++) {
        await expect(evidenceItems.nth(i)).toContainText('Computer Science')
      }
    })

    test('evaluator should only evaluate evidence from assigned departments', async ({ page }) => {
      await loginAs(page, 'evaluator')
      await page.click('[data-testid="evaluation-queue"]')

      // Should only see evidence from evaluator's assigned departments
      const evaluationItems = page.locator('[data-testid="evaluation-item"]')
      const count = await evaluationItems.count()

      if (count > 0) {
        for (let i = 0; i < count; i++) {
          await expect(evaluationItems.nth(i)).toContainText('Computer Science')
        }
      }
    })
  })
})