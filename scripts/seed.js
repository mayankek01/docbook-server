import mongoose from "mongoose";
import dotenv from "dotenv";
import Doctor from "../models/doctor.model.js";
import Slot from "../models/slot.model.js";

dotenv.config();

// Helper: get next N days as "YYYY-MM-DD" strings
const getNextDates = (days) => {
  const dates = [];
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(date.toISOString().split("T")[0]);
  }

  return dates;
};

// Helper: generate slot documents from a time range
const generateSlots = (doctorId, date, startTime, endTime, duration) => {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;

  const slots = [];
  let current = startMin;

  while (current + duration <= endMin) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

    slots.push({
      doctor: doctorId,
      date,
      startTime: timeStr,
      duration,
      status: "available",
    });

    current += duration;
  }

  return slots;
};

const doctorsData = [
  {
    name: "Dr. Priya Sharma",
    email: "priya.sharma@docsbook.com",
    phone: "+91-9876543210",
    description:
      "Senior cardiologist with expertise in interventional cardiology and preventive heart care. Specializes in treating complex cardiac conditions.",
    speciality: "Cardiologist",
    experience: 15,
    totalPatients: 4200,
    rating: 4.8,
    location: "Delhi",
    availability: { start: "09:00", end: "13:00", duration: 30 },
  },
  {
    name: "Dr. Rahul Verma",
    email: "rahul.verma@docsbook.com",
    phone: "+91-9876543211",
    description:
      "Experienced general physician focused on holistic health management. Treats common ailments and provides comprehensive health checkups.",
    speciality: "General Physician",
    experience: 10,
    totalPatients: 6800,
    rating: 4.6,
    location: "Delhi",
    availability: { start: "10:00", end: "14:00", duration: 30 },
  },
  {
    name: "Dr. Sneha Patel",
    email: "sneha.patel@docsbook.com",
    phone: "+91-9876543212",
    description:
      "Dermatologist specializing in acne treatment, skin allergies, and cosmetic dermatology. Known for effective treatment plans.",
    speciality: "Dermatologist",
    experience: 8,
    totalPatients: 3500,
    rating: 4.7,
    location: "Mumbai",
    availability: { start: "11:00", end: "16:00", duration: 30 },
  },
  {
    name: "Dr. Amit Kumar",
    email: "amit.kumar@docsbook.com",
    phone: "+91-9876543213",
    description:
      "Orthopedic surgeon specializing in joint replacement and sports injuries. Uses minimally invasive techniques for faster recovery.",
    speciality: "Orthopedic",
    experience: 12,
    totalPatients: 2800,
    rating: 4.5,
    location: "Delhi",
    availability: { start: "09:00", end: "12:00", duration: 30 },
  },
  {
    name: "Dr. Meera Reddy",
    email: "meera.reddy@docsbook.com",
    phone: "+91-9876543214",
    description:
      "Pediatrician with a gentle approach to child healthcare. Specializes in newborn care, vaccinations, and developmental disorders.",
    speciality: "Pediatrician",
    experience: 14,
    totalPatients: 5600,
    rating: 4.9,
    location: "Bangalore",
    availability: { start: "10:00", end: "15:00", duration: 30 },
  },
  {
    name: "Dr. Sanjay Gupta",
    email: "sanjay.gupta@docsbook.com",
    phone: "+91-9876543215",
    description:
      "Neurologist experienced in treating migraines, epilepsy, and neurodegenerative conditions. Focuses on accurate diagnosis.",
    speciality: "Neurologist",
    experience: 18,
    totalPatients: 3200,
    rating: 4.7,
    location: "Delhi",
    availability: { start: "09:30", end: "13:30", duration: 45 },
  },
  {
    name: "Dr. Anita Singh",
    email: "anita.singh@docsbook.com",
    phone: "+91-9876543216",
    description:
      "ENT specialist with expertise in sinus surgery, hearing disorders, and voice problems. Provides medical and surgical solutions.",
    speciality: "ENT Specialist",
    experience: 9,
    totalPatients: 2100,
    rating: 4.4,
    location: "Mumbai",
    availability: { start: "10:00", end: "13:00", duration: 30 },
  },
  {
    name: "Dr. Kavita Joshi",
    email: "kavita.joshi@docsbook.com",
    phone: "+91-9876543217",
    description:
      "Gynecologist focused on women's health, prenatal care, and minimally invasive surgeries. Compassionate and thorough approach.",
    speciality: "Gynecologist",
    experience: 11,
    totalPatients: 3900,
    rating: 4.6,
    location: "Delhi",
    availability: { start: "10:00", end: "14:00", duration: 30 },
  },
  {
    name: "Dr. Vikram Rao",
    email: "vikram.rao@docsbook.com",
    phone: "+91-9876543218",
    description:
      "Psychiatrist specializing in anxiety, depression, and stress management. Combines medication with therapeutic counseling.",
    speciality: "Psychiatrist",
    experience: 7,
    totalPatients: 1800,
    rating: 4.5,
    location: "Bangalore",
    availability: { start: "11:00", end: "16:00", duration: 45 },
  },
  {
    name: "Dr. Rajan Mehta",
    email: "rajan.mehta@docsbook.com",
    phone: "+91-9876543219",
    description:
      "Experienced dentist providing general dentistry, root canal treatments, and cosmetic dental procedures. Painless treatment priority.",
    speciality: "Dentist",
    experience: 6,
    totalPatients: 4500,
    rating: 4.3,
    location: "Mumbai",
    availability: { start: "09:00", end: "14:00", duration: 30 },
  },
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Clear existing data
    await Doctor.deleteMany({});
    await Slot.deleteMany({});
    console.log("Cleared existing doctors and slots");

    // Get the next 6 days
    const dates = getNextDates(6);
    console.log("Generating slots for dates:", dates);

    for (const docData of doctorsData) {
      // Separate availability from doctor fields
      const { availability, ...doctorFields } = docData;

      // Create the doctor
      const doctor = await Doctor.create(doctorFields);
      console.log(`Created: ${doctor.name}`);

      // Generate slots for each of the next 6 days
      let allSlots = [];
      for (const date of dates) {
        const daySlots = generateSlots(
          doctor._id,
          date,
          availability.start,
          availability.end,
          availability.duration
        );
        allSlots = allSlots.concat(daySlots);
      }

      await Slot.insertMany(allSlots);
      console.log(`  → ${allSlots.length} slots (${allSlots.length / 6} per day × 6 days)`);
    }

    console.log("\nSeeding complete!");
    console.log(`Doctors: ${await Doctor.countDocuments()}`);
    console.log(`Slots: ${await Slot.countDocuments()}`);

    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
};

seed();