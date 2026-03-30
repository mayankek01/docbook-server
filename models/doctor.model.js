import mongoose from "mongoose";

const SPECIALITIES = [
  "General Physician",
  "Dermatologist",
  "Cardiologist",
  "Orthopedic",
  "Pediatrician",
  "Neurologist",
  "ENT Specialist",
  "Gynecologist",
  "Psychiatrist",
  "Dentist",
];

const doctorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Doctor name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
    },
    description: {
      type: String,
      default: "",
    },
    speciality: {
      type: String,
      required: [true, "Speciality is required"],
      enum: {
        values: SPECIALITIES,
        message: "{VALUE} is not a valid speciality",
      },
    },
    experience: {
      type: Number,
      required: [true, "Experience is required"],
      min: 0,
    },
    totalPatients: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      default: 4.0,
      min: 0,
      max: 5,
    },
    location: {
      type: String,
      required: [true, "Location is required"],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Export specialities so other files (seed script, routes) can use this list
export { SPECIALITIES };

const Doctor = mongoose.model("Doctor", doctorSchema);

export default Doctor;