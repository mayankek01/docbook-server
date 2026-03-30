import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

import authRoutes from "./routes/auth.routes.js";
import doctorRoutes from "./routes/doctor.routes.js";
import slotRoutes from "./routes/slot.routes.js";
import ragRoutes from "./routes/rag.routes.js";
const app = express();

// CORS — allow both local development and deployed frontend
app.use(cors({
  origin: [
    "http://localhost:3000",
    process.env.FRONTEND_URL,  // Your Vercel URL, set in Render env vars
  ].filter(Boolean),  // filter(Boolean) removes undefined if FRONTEND_URL is not set
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "DocsBook API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/slots", slotRoutes);
app.use("/api/rag", ragRoutes);

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB successfully");
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => console.error("Connection error:", error));