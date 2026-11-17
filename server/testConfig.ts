/** Where the test MySQL lives (shared by the vitest global setup and the per-file helper; imports nothing from vitest). */
export const TEST_MYSQL_URL = process.env.TEST_MYSQL_URL ?? 'mysql://root:cocos-test-only@127.0.0.1:3317';
