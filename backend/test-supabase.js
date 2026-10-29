
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;

async function testSupabase() {
  if (!url || !key) {
    console.error(
      "Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in backend/.env"
    );
    return;
  }

  const supabase = createClient(url, key);

  console.log("Testing connection to Supabase...");

  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .limit(1);

  if (error) {
    console.error("Supabase query failed:", error.message);
    console.error("Error code:", error.code || "Not provided");
    return;
  }

  console.log("Supabase API connection successful!");
  console.log("Query completed. Rows returned:", data.length);
}

testSupabase().catch((error) => {
  console.error("Unexpected test error:", error.message);
});
