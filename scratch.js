import pg from 'pg';
const { Client } = pg;
const client = new Client({
  host: '127.0.0.1',
  port: 55322,
  user: 'postgres',
  password: 'postgres',
  database: 'postgres'
});

async function run() {
  await client.connect();
  const res = await client.query("SELECT id, title, file_type, file_url, storage_path FROM shared_files WHERE file_type = 'recording'");
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}
run().catch(console.error);
