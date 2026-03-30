import express from "express";
import Doctor, { SPECIALITIES } from "../models/doctor.model.js";

const router = express.Router();

// GET /api/doctors?speciality=Cardiologist&location=Delhi&page=1&limit=10
router.get("/", async (req, res) => {
  try {
    const { speciality, location, page = 1, limit = 10 } = req.query;

    const filter = {};

    if (speciality) {
      filter.speciality = speciality;
    }

    if (location) {
      filter.location = { $regex: location, $options: "i" };
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const total = await Doctor.countDocuments(filter);

    const doctors = await Doctor.find(filter)
      .select("-email -phone")
      .sort({ rating: -1 })
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      count: doctors.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      doctors,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/doctors/specialities
router.get("/specialities", (req, res) => {
  res.status(200).json({ specialities: SPECIALITIES });
});

// GET /api/doctors/:id
router.get("/:id", async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    res.status(200).json(doctor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;