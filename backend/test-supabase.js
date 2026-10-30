
const supabase = require("./config/supabase");

async function testConnection() {
  console.log("Testing the reusable Supabase connection...");

  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .limit(1);

  if (error) {
    console.error("Supabase query failed:", error.message);
    process.exitCode = 1;
    return;
  }

  console.log("Supabase connection successful!");
  console.log("Rows returned:", data.length);
}

testConnection().catch((error) => {
  console.error("Unexpected error:", error.message);
  process.exitCode = 1;
});
