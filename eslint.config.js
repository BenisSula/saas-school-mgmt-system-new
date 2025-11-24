const js = require('@eslint/js');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const reactPlugin = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const globals = require('globals');
const prettierConfig = require('eslint-config-prettier');

const ignores = {
  ignores: [
    'node_modules/**',
    'dist/**',
    'build/**',
    'coverage/**',
    '.husky/_/**',
    '*.config.js',
    '*.config.ts',
    'frontend/src/lib/api-types.ts',
    'frontend/src/lib/api-types.d.ts'
  ]
};

const backendConfig = {
  files: ['backend/**/*.ts'],
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 'latest',
    sourceType: 'module',
    globals: {
      ...globals.node,
      ...globals.jest
    }
  },
  plugins: {
    '@typescript-eslint': tsPlugin
  },
  rules: {
    ...js.configs.recommended.rules,
    ...tsPlugin.configs.recommended.rules,
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }]
  }
};

const frontendConfig = {
  files: ['frontend/**/*.{ts,tsx}'],
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 'latest',
    sourceType: 'module',
    globals: {
      ...globals.browser
    }
  },
  plugins: {
    '@typescript-eslint': tsPlugin,
    react: reactPlugin,
    'react-hooks': reactHooks
  },
  settings: {
    react: {
      version: 'detect'
    }
  },
  rules: {
    ...js.configs.recommended.rules,
    ...tsPlugin.configs.recommended.rules,
    ...reactPlugin.configs.recommended.rules,
    ...reactHooks.configs.recommended.rules,
    ...prettierConfig.rules,
    'react/react-in-jsx-scope': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'react/prop-types': 'off' // Using TypeScript for prop validation
  }
};

module.exports = [ignores, backendConfig, frontendConfig, prettierConfig];

