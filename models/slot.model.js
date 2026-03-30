import mongoose from "mongoose";

const slotSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: [true, "Doctor reference is required"],
    },
    date: {
      // Stored as string "2026-03-30" for easy querying
      type: String,
      required: [true, "Date is required"],
    },
    startTime: {
      // Stored as "10:00", "14:30" in 24hr format
      type: String,
      required: [true, "Start time is required"],
    },
    duration: {
      // In minutes (15, 30, 45, 60)
      type: Number,
      required: [true, "Duration is required"],
      min: 15,
      max: 60,
    },
    status: {
      type: String,
      enum: {
        values: ["available", "booked", "cancelled"],
        message: "{VALUE} is not a valid status",
      },
      default: "available",
    },
    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    patientNotes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: fast lookup for "all slots for this doctor on this date"
slotSchema.index({ doctor: 1, date: 1 });

// Index: fast lookup for "all bookings by this user"
slotSchema.index({ bookedBy: 1 });

const Slot = mongoose.model("Slot", slotSchema);

export default Slot;