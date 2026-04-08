const { Client } = require("pg");
const client = new Client({ connectionString: "postgresql://myuser:mypassword@localhost:5433/mydatabase" });
client.connect().then(async () => {
  const res = await client.query("SELECT s3_url FROM extractions WHERE id = '350abccf-ae1d-4b1e-88cb-01b8f08f15bc'");
  console.log(res.rows[0]);
  process.exit(0);
});
