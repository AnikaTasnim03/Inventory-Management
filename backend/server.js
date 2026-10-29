
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Basic API test route
app.get("/", (req, res) => {
  res.json({
    message: "Inventra API is running successfully!",
  });
});

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error(
        "MONGODB_URI is missing from the backend .env file."
      );
    }

    console.log("Connecting to MongoDB Atlas...");

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
    });

    console.log("MongoDB connected successfully!");

    app.listen(PORT, () => {
      console.log(`Inventra server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("\nMongoDB connection failed:");
    console.error("Error type:", error.name);
    console.error("Message:", error.message);

    // Show the underlying errors for individual MongoDB servers.
    const servers = error.reason?.servers;

    if (servers) {
      for (const [address, server] of servers) {
        console.error("\nServer:", address);
        console.error("Server state:", server.type);
        console.error(
          "Underlying error:",
          server.error?.message || "No underlying error reported"
        );
      }
    }

    // Show the cause if one is available.
    if (error.cause?.message) {
      console.error("\nAdditional cause:", error.cause.message);
    }

    console.error(
      "\nCheck the detailed errors above before changing connection settings."
    );

    process.exitCode = 1;
  }
}

startServer();
