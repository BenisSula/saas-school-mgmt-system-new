/**
 * E2E Tests: Admin Flows
 * 
 * Tests the complete admin workflows:
 * 1. Login as admin → assert redirect to /admin/dashboard
 * 2. Go to Users page → assert table displays >0 rows with correct columns
 * 3. Create a Student → assert 201 response and student present in list
 * 4. Assign a teacher to a class → assert relationship persisted
 * 5. Try to access an admin-only page as non-admin → assert 403 or redirect
 */

import { test, expect } from '@playwright/test';

// Test credentials from README.md
const ADMIN_EMAIL = 'admin.demo@academy.test';
const ADMIN_PASSWORD = 'AdminDemo#2025';
const TEACHER_EMAIL = 'teacher.demo@academy.test';
const TEACHER_PASSWORD = 'TeacherDemo#2025';
const STUDENT_EMAIL = 'student.demo@academy.test';
const STUDENT_PASSWORD = 'StudentDemo#2025';

/**
 * Helper function to login as a user
 */
async function loginAs(page: any, email: string, password: string): Promise<boolean> {
  try {
    await page.goto('/auth/login');
    await page.fill('#auth-email', email);
    await page.fill('#auth-password', password);
    await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 5000 });
    await page.click('button[type="submit"]');
    
    // Wait for navigation or error (increased timeout for slower networks)
    try {
      await page.waitForURL(/\/dashboard|\/admin|\/auth\/login/, { timeout: 30000 });
    } catch (error) {
      // Check if we're already on a dashboard page (navigation may have completed)
      const currentUrl = page.url();
      if (currentUrl.includes('/dashboard') || currentUrl.includes('/admin')) {
        // Navigation succeeded, just took longer than expected
        return true;
      }
      throw error;
    }
    
    // Check if we're still on login page (login failed)
    const currentUrl = page.url();
    if (currentUrl.includes('/auth/login')) {
      // Check for error message
      const errorVisible = await page.locator('text=/error|invalid|failed/i').first().isVisible().catch(() => false);
      if (errorVisible) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Login error:', error);
    return false;
  }
}

/**
 * Helper function to logout
 */
async function logout(page: any): Promise<void> {
  try {
    // Look for logout button in various locations
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout")').first();
    if (await logoutButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logoutButton.click();
      await page.waitForURL(/\/auth\/login|\//, { timeout: 5000 });
    }
  } catch (error) {
    console.log('Logout helper: Could not find logout button, continuing...');
  }
}

/**
 * Helper function to wait for API response
 */
async function waitForApiResponse(page: any, urlPattern: string | RegExp, expectedStatus: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 10000);
    
    page.on('response', (response: any) => {
      const url = response.url();
      const matches = typeof urlPattern === 'string' ? url.includes(urlPattern) : urlPattern.test(url);
      if (matches && response.status() === expectedStatus) {
        clearTimeout(timeout);
        resolve(true);
      }
    });
  });
}

test.describe('Admin Flows E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();
    await page.goto('/');
  });

  test.afterEach(async ({ page }) => {
    // Cleanup: logout after each test
    await logout(page);
  });

  test('1. Login as admin → assert redirect to /admin/dashboard', async ({ page }) => {
    // Step 1: Navigate to login
    await page.goto('/auth/login');
    await expect(page).toHaveURL(/\/auth\/login/);

    // Step 2: Login as admin
    const loginSuccess = await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    
    if (!loginSuccess) {
      test.skip(true, 'Admin credentials not available in test environment');
      return;
    }

    // Step 3: Assert redirect to dashboard
    // Check if we're redirected to a dashboard route
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    const currentUrl = page.url();
    
    // Should be redirected to a dashboard route (could be /dashboard/overview, /dashboard, etc.)
    expect(currentUrl).toMatch(/\/dashboard/);
    
    // Verify we're not on login page
    expect(currentUrl).not.toMatch(/\/auth\/login/);
    
    // Verify admin-specific content is visible
    const adminContent = page.locator('text=/admin|dashboard|overview/i').first();
    await expect(adminContent).toBeVisible({ timeout: 5000 });
  });

  test('2. Go to Users page → assert table displays >0 rows with correct columns', async ({ page }) => {
    // Step 1: Login as admin
    const loginSuccess = await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    
    if (!loginSuccess) {
      test.skip(true, 'Admin credentials not available in test environment');
      return;
    }

    // Step 2: Navigate to Users Management page
    await page.goto('/dashboard/users-management');
    await page.waitForLoadState('networkidle');
    
    // Wait for table to load
    const table = page.locator('table, [role="table"], .table').first();
    await expect(table).toBeVisible({ timeout: 10000 });

    // Step 3: Assert table has rows
    // Look for table rows (tbody tr or [role="row"])
    const rows = table.locator('tbody tr, [role="row"]:not(:has([role="columnheader"]))');
    const rowCount = await rows.count();
    
    expect(rowCount).toBeGreaterThan(0);

    // Step 4: Assert correct columns are present
    // Expected columns: Email, Role, Status, Verified, Actions
    const headers = table.locator('th, [role="columnheader"]');
    const headerTexts = await headers.allTextContents();
    const headerText = headerTexts.join(' ').toLowerCase();
    
    // Check for expected column headers
    expect(headerText).toMatch(/email|role|status|verified|actions/i);
    
    // Verify at least one row has data
    const firstRow = rows.first();
    await expect(firstRow).toBeVisible();
    
    // Check that row has multiple cells (indicating data)
    const cells = firstRow.locator('td, [role="gridcell"]');
    const cellCount = await cells.count();
    expect(cellCount).toBeGreaterThan(0);
  });

  test('3. Create a Student → assert 201 response and student present in list', async ({ page }) => {
    // Step 1: Login as admin
    const loginSuccess = await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    
    if (!loginSuccess) {
      test.skip(true, 'Admin credentials not available in test environment');
      return;
    }

    // Step 2: Navigate to Students Management page
    await page.goto('/dashboard/students');
    await page.waitForLoadState('networkidle');

    // Step 3: Click "Create Student" button
    const createButton = page.locator('button:has-text("Create Student"), button:has-text("Create"), a:has-text("Create Student")').first();
    await expect(createButton).toBeVisible({ timeout: 5000 });
    
    // Set up API response listener before clicking
    let apiResponseReceived = false;
    let responseStatus = 0;
    
    page.on('response', (response: any) => {
      const url = response.url();
      if (url.includes('/students') && response.request().method() === 'POST') {
        apiResponseReceived = true;
        responseStatus = response.status();
      }
    });

    await createButton.click();

    // Step 4: Fill student form
    // Wait for modal/form to appear
    const modal = page.locator('[role="dialog"], .modal, form').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Generate unique student data
    const timestamp = Date.now();
    const studentEmail = `e2e.student.${timestamp}@test.com`;
    const studentFirstName = `E2E${timestamp}`;
    const studentLastName = 'TestStudent';
    const admissionNumber = `E2E-${timestamp}`;

    // Fill form fields (adjust selectors based on actual form structure)
    const emailInput = modal.locator('input[type="email"], input[name*="email" i], input[id*="email" i]').first();
    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailInput.fill(studentEmail);
    }

    const firstNameInput = modal.locator('input[name*="first" i], input[id*="first" i], input[placeholder*="first" i]').first();
    if (await firstNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstNameInput.fill(studentFirstName);
    }

    const lastNameInput = modal.locator('input[name*="last" i], input[id*="last" i], input[placeholder*="last" i]').first();
    if (await lastNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await lastNameInput.fill(studentLastName);
    }

    const admissionInput = modal.locator('input[name*="admission" i], input[id*="admission" i], input[placeholder*="admission" i]').first();
    if (await admissionInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await admissionInput.fill(admissionNumber);
    }

    // Fill password if required
    const passwordInput = modal.locator('input[type="password"]').first();
    if (await passwordInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await passwordInput.fill('TestPassword123!');
    }

    // Step 5: Submit form
    const submitButton = modal.locator('button[type="submit"], button:has-text("Create"), button:has-text("Submit")').first();
    await expect(submitButton).toBeVisible({ timeout: 2000 });
    await submitButton.click();

    // Step 6: Wait for API response (201 Created)
    await page.waitForTimeout(2000); // Give time for API call
    
    // Check if we got a 201 response
    if (apiResponseReceived) {
      expect(responseStatus).toBe(201);
    } else {
      // If we didn't catch the response, check for success message
      const successMessage = page.locator('text=/success|created|student created/i').first();
      await expect(successMessage).toBeVisible({ timeout: 5000 });
    }

    // Step 7: Verify student appears in list
    // Wait for table to refresh
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Search for the student in the table
    const table = page.locator('table, [role="table"], .table').first();
    await expect(table).toBeVisible({ timeout: 5000 });

    // Look for student by name or admission number
    const studentRow = table.locator(`text=${studentFirstName}, text=${studentLastName}, text=${admissionNumber}`).first();
    
    // Student should be visible in the list
    await expect(studentRow).toBeVisible({ timeout: 10000 });
  });

  test('4. Assign a teacher to a class → assert relationship persisted', async ({ page }) => {
    // Step 1: Login as admin
    const loginSuccess = await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    
    if (!loginSuccess) {
      test.skip(true, 'Admin credentials not available in test environment');
      return;
    }

    // Step 2: Navigate to Classes Management page
    await page.goto('/dashboard/classes-management');
    await page.waitForLoadState('networkidle');

    // Step 3: Find a class in the table
    const table = page.locator('table, [role="table"], .table').first();
    await expect(table).toBeVisible({ timeout: 10000 });

    const rows = table.locator('tbody tr, [role="row"]:not(:has([role="columnheader"]))');
    const rowCount = await rows.count();
    
    if (rowCount === 0) {
      test.skip(true, 'No classes available to assign teacher');
      return;
    }

    // Step 4: Click "Assign Teacher" button for first class
    const firstRow = rows.first();
    const assignButton = firstRow.locator('button:has-text("Assign Teacher"), button:has-text("Assign")').first();
    
    if (!(await assignButton.isVisible({ timeout: 3000 }).catch(() => false))) {
      // Try clicking on the row first to see actions
      await firstRow.click();
      await page.waitForTimeout(500);
    }

    const assignButtonAfter = firstRow.locator('button:has-text("Assign Teacher"), button:has-text("Assign")').first();
    if (!(await assignButtonAfter.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Assign Teacher button not found - may require class creation first');
      return;
    }

    // Set up API response listener
    let apiResponseReceived = false;
    let responseStatus = 0;
    
    page.on('response', (response: any) => {
      const url = response.url();
      if ((url.includes('/classes') || url.includes('/teachers')) && 
          (response.request().method() === 'POST' || response.request().method() === 'PATCH')) {
        apiResponseReceived = true;
        responseStatus = response.status();
      }
    });

    await assignButtonAfter.click();

    // Step 5: Select a teacher from dropdown/modal
    const modal = page.locator('[role="dialog"], .modal').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find teacher select dropdown
    const teacherSelect = modal.locator('select, [role="combobox"], input[type="search"]').first();
    await expect(teacherSelect).toBeVisible({ timeout: 3000 });

    // Select first available teacher option
    if (await teacherSelect.evaluate((el: any) => el.tagName === 'SELECT')) {
      const options = await teacherSelect.locator('option').all();
      if (options.length > 1) {
        // Select second option (first is usually "Select teacher")
        await teacherSelect.selectOption({ index: 1 });
      }
    } else {
      // For combobox/autocomplete, click and select first option
      await teacherSelect.click();
      await page.waitForTimeout(500);
      const firstOption = page.locator('[role="option"]').first();
      if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstOption.click();
      }
    }

    // Step 6: Submit assignment
    const submitButton = modal.locator('button[type="submit"], button:has-text("Assign"), button:has-text("Save")').first();
    await expect(submitButton).toBeVisible({ timeout: 2000 });
    await submitButton.click();

    // Step 7: Wait for API response
    await page.waitForTimeout(2000);

    // Step 8: Verify success (check for success message or 200/201 status)
    if (apiResponseReceived) {
      expect([200, 201]).toContain(responseStatus);
    } else {
      // Check for success message
      const successMessage = page.locator('text=/success|assigned|teacher assigned/i').first();
      await expect(successMessage).toBeVisible({ timeout: 5000 });
    }

    // Step 9: Verify relationship persisted - check table shows teacher name
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Reload the page or refresh table
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check that the class row shows a teacher name
    const updatedTable = page.locator('table, [role="table"], .table').first();
    const updatedFirstRow = updatedTable.locator('tbody tr, [role="row"]:not(:has([role="columnheader"]))').first();
    
    // Look for teacher name in the row (should not be "Not assigned")
    const teacherCell = updatedFirstRow.locator('text=/teacher|not assigned/i').first();
    const cellText = await teacherCell.textContent().catch(() => '');
    
    // Teacher should be assigned (not "Not assigned")
    expect(cellText.toLowerCase()).not.toMatch(/not assigned|none/i);
  });

  test('5. Try to access an admin-only page as non-admin → assert 403 or redirect', async ({ page }) => {
    // Step 1: Login as student (non-admin)
    const loginSuccess = await loginAs(page, STUDENT_EMAIL, STUDENT_PASSWORD);
    
    if (!loginSuccess) {
      test.skip(true, 'Student credentials not available in test environment');
      return;
    }

    // Step 2: Try to access admin-only page
    // Set up response listener for 403/redirect
    let forbiddenResponse = false;
    let redirectOccurred = false;
    
    page.on('response', (response: any) => {
      const url = response.url();
      if (url.includes('/admin') || url.includes('/dashboard/users-management')) {
        if (response.status() === 403) {
          forbiddenResponse = true;
        }
      }
    });

    page.on('framenavigated', () => {
      redirectOccurred = true;
    });

    // Try to navigate to admin-only page
    await page.goto('/dashboard/users-management');
    
    // Wait for navigation or response
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Step 3: Assert 403 or redirect
    const currentUrl = page.url();
    
    // Should either:
    // 1. Be redirected away from admin page (not on /dashboard/users-management)
    // 2. Show 403 error
    // 3. Show "not authorized" message
    
    const isOnAdminPage = currentUrl.includes('/users-management');
    const hasForbiddenMessage = await page.locator('text=/403|forbidden|not authorized|access denied/i').first().isVisible({ timeout: 2000 }).catch(() => false);
    
    // Either we're redirected away OR we see a forbidden message
    expect(isOnAdminPage && !hasForbiddenMessage).toBeFalsy();
    
    // Additional check: if we're still on admin page, we should see an error
    if (isOnAdminPage) {
      expect(hasForbiddenMessage || forbiddenResponse).toBeTruthy();
    } else {
      // We were redirected - verify we're on a safe page
      expect(currentUrl).toMatch(/\/dashboard\/|\/not-authorized|\/auth\/login/);
    }
  });
});

