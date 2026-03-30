import express from "express";
import Slot from "../models/slot.model.js";
import Doctor from "../models/doctor.model.js";
import User from "../models/user.model.js";
import auth from "../middleware/auth.js";
import { sendBookingEmails, sendCancellationEmails } from "../utils/email.js";

const router = express.Router();

// ============================================
// DOCTOR-SIDE: Create availability slots
// ============================================

// POST /api/slots/availability
router.post("/availability", async (req, res) => {
  try {
    const { doctorId, date, startTime, endTime, duration } = req.body;

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);

    const startInMinutes = startHour * 60 + startMin;
    const endInMinutes = endHour * 60 + endMin;

    if (startInMinutes >= endInMinutes) {
      return res.status(400).json({ message: "End time must be after start time" });
    }

    const slots = [];
    let current = startInMinutes;

    while (current + duration <= endInMinutes) {
      const hours = Math.floor(current / 60);
      const mins = current % 60;
      const timeString = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;

      const existingSlot = await Slot.findOne({
        doctor: doctorId,
        date,
        startTime: timeString,
      });

      if (!existingSlot) {
        slots.push({
          doctor: doctorId,
          date,
          startTime: timeString,
          duration,
          status: "available",
        });
      }

      current += duration;
    }

    const createdSlots = await Slot.insertMany(slots);

    res.status(201).json({
      message: `${createdSlots.length} slots created`,
      slots: createdSlots,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// PATIENT-SIDE
// ============================================

// GET /api/slots/user/my-bookings
router.get("/user/my-bookings", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const bookings = await Slot.find({
      bookedBy: userId,
      status: "booked",
    })
      .populate("doctor", "name speciality location phone email")
      .sort({ date: 1, startTime: 1 });

    res.status(200).json({ bookings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/slots/:doctorId?date=2026-03-30
router.get("/:doctorId", async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: "Date query parameter is required" });
    }

    let slots = await Slot.find({
      doctor: doctorId,
      date,
      status: { $ne: "cancelled" },
    })
      .select("date startTime duration status")
      .sort({ startTime: 1 });

    // If the requested date is today, filter out slots whose time has passed
    const today = new Date().toISOString().split("T")[0];

    if (date === today) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      slots = slots.filter((slot) => {
        const [h, m] = slot.startTime.split(":").map(Number);
        const slotMinutes = h * 60 + m;
        return slotMinutes > currentMinutes;
      });
    }

    res.status(200).json({ slots });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/slots/:slotId/book
router.post("/:slotId/book", auth, async (req, res) => {
  try {
    const { slotId } = req.params;
    const { patientNotes } = req.body;
    const userId = req.user.id;

    const slot = await Slot.findById(slotId);

    if (!slot) {
      return res.status(404).json({ message: "Slot not found" });
    }

    if (slot.status !== "available") {
      return res.status(400).json({ message: "This slot is no longer available" });
    }

    // Prevent booking past slots via API
    const today = new Date().toISOString().split("T")[0];

    if (slot.date < today) {
      return res.status(400).json({ message: "Cannot book a slot in the past" });
    }

    if (slot.date === today) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [h, m] = slot.startTime.split(":").map(Number);
      const slotMinutes = h * 60 + m;

      if (slotMinutes <= currentMinutes) {
        return res.status(400).json({ message: "This slot time has already passed" });
      }
    }

    // Book the slot
    slot.status = "booked";
    slot.bookedBy = userId;
    slot.patientNotes = patientNotes || "";
    await slot.save();

    // Fetch doctor and patient details for the email
    const doctor = await Doctor.findById(slot.doctor);
    const patient = await User.findById(userId);

    // Send emails to both (runs in background, doesn't block response)
    sendBookingEmails({
      patientName: patient.name,
      patientEmail: patient.email,
      doctorName: doctor.name,
      doctorEmail: doctor.email,
      date: slot.date,
      startTime: slot.startTime,
      duration: slot.duration,
      patientNotes: slot.patientNotes,
      doctorSpeciality: doctor.speciality,
      doctorLocation: doctor.location,
    });

    res.status(200).json({
      message: "Appointment booked successfully",
      appointment: {
        id: slot._id,
        date: slot.date,
        startTime: slot.startTime,
        duration: slot.duration,
        doctor: {
          _id: doctor._id,
          name: doctor.name,
          speciality: doctor.speciality,
          location: doctor.location,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/slots/:slotId/cancel
router.post("/:slotId/cancel", auth, async (req, res) => {
  try {
    const { slotId } = req.params;
    const userId = req.user.id;

    const slot = await Slot.findById(slotId);

    if (!slot) {
      return res.status(404).json({ message: "Slot not found" });
    }

    if (!slot.bookedBy || slot.bookedBy.toString() !== userId) {
      return res.status(403).json({ message: "You can only cancel your own bookings" });
    }

    // Fetch details before resetting for the cancellation email
    const doctor = await Doctor.findById(slot.doctor);
    const patient = await User.findById(userId);
    const slotDate = slot.date;
    const slotTime = slot.startTime;

    // Reset the slot
    slot.status = "available";
    slot.bookedBy = null;
    slot.patientNotes = "";
    await slot.save();

    // Send cancellation emails (runs in background)
    sendCancellationEmails({
      patientName: patient.name,
      patientEmail: patient.email,
      doctorName: doctor.name,
      doctorEmail: doctor.email,
      date: slotDate,
      startTime: slotTime,
    });

    res.status(200).json({ message: "Booking cancelled successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;