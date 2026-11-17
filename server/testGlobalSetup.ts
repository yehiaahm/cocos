import { createConnection } from 'mysql2/promise';
import { TEST_MYSQL_URL } from './testConfig';

/** Fails fast with a useful message when no MySQL is reachable, and sweeps databases left behind by crashed runs. */
export default async function setup() {
  let admin;
  try {
    admin = await createConnection({ uri: TEST_MYSQL_URL, connectTimeout: 5000 });
  } catch (e) {
    throw new Error(
      `Tests need a MySQL server (${(e as Error).message}).\n` +
        'Start one:  docker run -d --name cocos-mysql-test -e MYSQL_ROOT_PASSWORD=cocos-test-only -p 3317:3306 mysql:8.4\n' +
        'or set TEST_MYSQL_URL=mysql://user:pass@host:port',
    );
  }
  try {
    const [rows] = await admin.query("SHOW DATABASES LIKE 'cocos\_test\_%'");
    for (const r of rows as Record<string, string>[]) await admin.query(`DROP DATABASE IF EXISTS \`${Object.values(r)[0]}\``);
  } finally {
    await admin.end();
  }
}
