import mongoose from "mongoose";
import dotenv from "dotenv";
import Doctor from "../models/doctor.model.js";

dotenv.config();

const HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const HF_API_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}/pipeline/feature-extraction`;

// Calls Hugging Face's free inference API to get embeddings
// all-MiniLM-L6-v2 is a popular sentence embedding model
// Returns a 384-dimensional vector (smaller than OpenAI's 1536 but works great)
const getEmbedding = async (text) => {
  const response = await fetch(HF_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: text,
      options: { wait_for_model: true },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HuggingFace API error: ${error}`);
  }

  const embedding = await response.json();
  return embedding;
};

// Combine speciality + description for richer embeddings
const createDoctorText = (doctor) => {
  return `${doctor.speciality}. ${doctor.description}`;
};

const generateEmbeddings = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const doctors = await Doctor.find({});
    console.log(`Found ${doctors.length} doctors\n`);

    for (const doctor of doctors) {
      const text = createDoctorText(doctor);
      console.log(`Generating embedding for: ${doctor.name}`);
      console.log(`  Text: "${text.substring(0, 80)}..."`);

      const embedding = await getEmbedding(text);
      console.log(`  Embedding size: ${embedding.length} dimensions`);

      doctor.embedding = embedding;
      await doctor.save();

      console.log(`  Saved!\n`);
    }

    console.log("All embeddings generated and saved!");
    process.exit(0);
  } catch (error) {
    console.error("Failed:", error.message);
    process.exit(1);
  }
};

generateEmbeddings();