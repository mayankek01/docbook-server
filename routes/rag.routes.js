import express from "express";
import Doctor from "../models/doctor.model.js";

const router = express.Router();

const HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const HF_API_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}/pipeline/feature-extraction`;

// Get embedding for user's input text
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
    throw new Error(`Embedding API error: ${error}`);
  }

  return await response.json();
};

// Cosine similarity measures how similar two vectors are
// Returns a value between -1 and 1 (1 = identical, 0 = unrelated, -1 = opposite)
// Formula: dot(A, B) / (magnitude(A) * magnitude(B))
const cosineSimilarity = (vecA, vecB) => {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) return 0;

  return dotProduct / (magnitudeA * magnitudeB);
};

// POST /api/rag/search
// User sends their problem, we find the most relevant doctors
router.post("/search", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: "Please describe your problem" });
    }

    // Step 1: Generate embedding for the user's problem
    const queryEmbedding = await getEmbedding(query);

    // Step 2: Get all doctors that have embeddings
    const doctors = await Doctor.find({
      embedding: { $exists: true, $ne: [] },
    }).select("-phone -email");

    // Step 3: Calculate similarity between user's query and each doctor
    const results = doctors.map((doctor) => {
      const similarity = cosineSimilarity(queryEmbedding, doctor.embedding);
      return {
        _id: doctor._id,
        name: doctor.name,
        speciality: doctor.speciality,
        description: doctor.description,
        experience: doctor.experience,
        totalPatients: doctor.totalPatients,
        rating: doctor.rating,
        location: doctor.location,
        similarity: Math.round(similarity * 100) / 100, // Round to 2 decimals
      };
    });

    // Step 4: Sort by similarity (highest first) and return top results
    results.sort((a, b) => b.similarity - a.similarity);

    // Return top 5 most relevant doctors
    const topResults = results.filter((d) => d.similarity >= 0.10).slice(0, 5);


    res.status(200).json({
      query,
      count: topResults.length,
      doctors: topResults,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;