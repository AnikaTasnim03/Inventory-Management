const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
});

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SECRET_KEY in backend/.env. Check that both values are filled in."
  );
}

const supabase = createClient(supabaseUrl, supabaseSecretKey);

module.exports = supabase;
