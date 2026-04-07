export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['js', 'php', 'docs', 'ci', 'deps'],
    ],
    'scope-empty': [1, 'never'],
  },
};
