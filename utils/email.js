import nodemailer from "nodemailer";

// Create reusable transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

// Helper: generate .ics calendar invite content
// This is a standard format that Gmail, Outlook, Apple Calendar all understand
const generateICS = ({ doctorName, patientName, date, startTime, duration, description }) => {
  // Parse date and time into a proper format
  // date = "2026-03-30", startTime = "10:00", duration = 30
  const [year, month, day] = date.split("-");
  const [hour, min] = startTime.split(":");

  // ICS uses UTC format: 20260330T100000Z
  // For simplicity we treat times as UTC — in production you'd handle timezones
  const startDate = `${year}${month}${day}T${hour}${min}00`;

  // Calculate end time
  const startMinutes = parseInt(hour) * 60 + parseInt(min);
  const endMinutes = startMinutes + duration;
  const endHour = String(Math.floor(endMinutes / 60)).padStart(2, "0");
  const endMin = String(endMinutes % 60).padStart(2, "0");
  const endDate = `${year}${month}${day}T${endHour}${endMin}00`;

  // Unique ID for this calendar event
  const uid = `docsbook-${Date.now()}@docsbook.com`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DocsBook//Appointment//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${startDate}`,
    `DTEND:${endDate}`,
    `SUMMARY:Appointment - ${doctorName} & ${patientName}`,
    `DESCRIPTION:${description}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
};

// Helper: format "09:00" to "9:00 AM"
const formatTime = (time) => {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
};

// Helper: format "2026-03-30" to "Monday, March 30, 2026"
const formatDate = (dateStr) => {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

// Send booking confirmation to both patient and doctor
export const sendBookingEmails = async ({
  patientName,
  patientEmail,
  doctorName,
  doctorEmail,
  date,
  startTime,
  duration,
  patientNotes,
  doctorSpeciality,
  doctorLocation,
}) => {
  const formattedDate = formatDate(date);
  const formattedTime = formatTime(startTime);

  const icsContent = generateICS({
    doctorName,
    patientName,
    date,
    startTime,
    duration,
    description: `DocsBook Appointment\\n${doctorSpeciality}\\nLocation: ${doctorLocation}\\nNotes: ${patientNotes || "None"}`,
  });

  // .ics file as attachment — both emails get the same calendar invite
  const icsAttachment = {
    filename: "appointment.ics",
    content: icsContent,
    contentType: "text/calendar; method=REQUEST",
  };

  // EMAIL TO PATIENT
  const patientMailOptions = {
    from: `"DocsBook" <${process.env.SMTP_EMAIL}>`,
    to: patientEmail,
    subject: `Appointment Confirmed with ${doctorName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2563eb; color: white; padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="margin: 0; font-size: 20px;">Appointment Confirmed ✓</h1>
        </div>
        <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
          <p>Hi <strong>${patientName}</strong>,</p>
          <p>Your appointment has been booked successfully!</p>
          
          <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Doctor:</strong> ${doctorName}</p>
            <p style="margin: 4px 0;"><strong>Speciality:</strong> ${doctorSpeciality}</p>
            <p style="margin: 4px 0;"><strong>Date:</strong> ${formattedDate}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${formattedTime}</p>
            <p style="margin: 4px 0;"><strong>Duration:</strong> ${duration} minutes</p>
            <p style="margin: 4px 0;"><strong>Location:</strong> ${doctorLocation}</p>
          </div>

          ${patientNotes ? `<p><strong>Your notes:</strong> ${patientNotes}</p>` : ""}
          
          <p style="color: #6b7280; font-size: 14px;">A calendar invite is attached to this email. Open it to add this appointment to your calendar.</p>
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">— DocsBook Team</p>
        </div>
      </div>
    `,
    attachments: [icsAttachment],
  };

  // EMAIL TO DOCTOR
  const doctorMailOptions = {
    from: `"DocsBook" <${process.env.SMTP_EMAIL}>`,
    to: doctorEmail,
    subject: `New Appointment - ${patientName} on ${formattedDate}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #059669; color: white; padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="margin: 0; font-size: 20px;">New Appointment Booked</h1>
        </div>
        <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
          <p>Hi <strong>${doctorName}</strong>,</p>
          <p>A new appointment has been booked with you.</p>
          
          <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Patient:</strong> ${patientName}</p>
            <p style="margin: 4px 0;"><strong>Email:</strong> ${patientEmail}</p>
            <p style="margin: 4px 0;"><strong>Date:</strong> ${formattedDate}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${formattedTime}</p>
            <p style="margin: 4px 0;"><strong>Duration:</strong> ${duration} minutes</p>
          </div>

          ${
            patientNotes
              ? `
          <div style="background-color: #fffbeb; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0;"><strong>Patient's notes:</strong></p>
            <p style="margin: 4px 0;">${patientNotes}</p>
          </div>`
              : ""
          }
          
          <p style="color: #6b7280; font-size: 14px;">A calendar invite is attached to this email.</p>
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">— DocsBook System</p>
        </div>
      </div>
    `,
    attachments: [icsAttachment],
  };

  // Send both emails in parallel
  try {
    await Promise.all([
      transporter.sendMail(patientMailOptions),
      transporter.sendMail(doctorMailOptions),
    ]);
    console.log(`Emails sent to ${patientEmail} and ${doctorEmail}`);
  } catch (error) {
    // Don't throw — email failure shouldn't break the booking
    console.error("Failed to send emails:", error.message);
  }
};

// Send cancellation email to both
export const sendCancellationEmails = async ({
  patientName,
  patientEmail,
  doctorName,
  doctorEmail,
  date,
  startTime,
}) => {
  const formattedDate = formatDate(date);
  const formattedTime = formatTime(startTime);

  const patientMailOptions = {
    from: `"DocsBook" <${process.env.SMTP_EMAIL}>`,
    to: patientEmail,
    subject: `Appointment Cancelled with ${doctorName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #dc2626; color: white; padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="margin: 0; font-size: 20px;">Appointment Cancelled</h1>
        </div>
        <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
          <p>Hi <strong>${patientName}</strong>,</p>
          <p>Your appointment with <strong>${doctorName}</strong> on <strong>${formattedDate}</strong> at <strong>${formattedTime}</strong> has been cancelled.</p>
          <p>You can book a new appointment anytime on DocsBook.</p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">— DocsBook Team</p>
        </div>
      </div>
    `,
  };

  const doctorMailOptions = {
    from: `"DocsBook" <${process.env.SMTP_EMAIL}>`,
    to: doctorEmail,
    subject: `Appointment Cancelled - ${patientName} on ${formattedDate}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #dc2626; color: white; padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="margin: 0; font-size: 20px;">Appointment Cancelled</h1>
        </div>
        <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
          <p>Hi <strong>${doctorName}</strong>,</p>
          <p>The appointment with <strong>${patientName}</strong> on <strong>${formattedDate}</strong> at <strong>${formattedTime}</strong> has been cancelled by the patient.</p>
          <p>The slot is now available for other patients.</p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">— DocsBook System</p>
        </div>
      </div>
    `,
  };

  try {
    await Promise.all([
      transporter.sendMail(patientMailOptions),
      transporter.sendMail(doctorMailOptions),
    ]);
    console.log(`Cancellation emails sent to ${patientEmail} and ${doctorEmail}`);
  } catch (error) {
    console.error("Failed to send cancellation emails:", error.message);
  }
};