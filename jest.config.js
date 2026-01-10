module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/**/*.test.js',
    '!server/npc/test-npc.js', // Exclude standalone test file
    '!server/server.js', // Exclude main server file
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 10000,
};
