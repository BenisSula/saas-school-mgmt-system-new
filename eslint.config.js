const js = require('@eslint/js');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const reactPlugin = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const globals = require('globals');

const ignores = {
  ignores: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**', '.husky/_/**']
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
    ...tsPlugin.configs.recommended.rules
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
    'react/react-in-jsx-scope': 'off'
  }
};

module.exports = [ignores, backendConfig, frontendConfig];

