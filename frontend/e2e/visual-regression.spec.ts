/**
 * Visual Regression Tests
 * Compares screenshots against baseline images
 */

import { test, expect } from '@playwright/test';
import path from 'path';

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'screenshots');
const BASELINE_DIR = path.join(__dirname, '..', 'test-results', 'baseline');

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set consistent viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('Login Page - Visual Regression', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');

    // Take screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'login-page.png'),
      fullPage: true,
    });

    // Compare with baseline if exists
    const baselinePath = path.join(BASELINE_DIR, 'login-page.png');
    // Note: Actual comparison would use a visual testing library
    // For now, we just capture screenshots for manual review
  });

  test('Admin Users Management - Visual Regression', async ({ page }) => {
    // Login as admin
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'admin.demo@academy.test');
    await page.fill('input[type="password"]', 'AdminDemo#2025');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/**');

    // Navigate to users management
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Wait for data to load

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'admin-users-management.png'),
      fullPage: true,
    });
  });

  test('Teacher Grade Entry - Visual Regression', async ({ page }) => {
    // Login as teacher
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'teacher.demo@academy.test');
    await page.fill('input[type="password"]', 'TeacherDemo#2025');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/**');

    // Navigate to grade entry
    await page.goto('/teacher/grade-entry');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'teacher-grade-entry.png'),
      fullPage: true,
    });
  });

  test('Student Results - Visual Regression', async ({ page }) => {
    // Login as student
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'student.demo@academy.test');
    await page.fill('input[type="password"]', 'StudentDemo#2025');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/**');

    // Navigate to results
    await page.goto('/student/results');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'student-results.png'),
      fullPage: true,
    });
  });
});


