# DocsBook — Backend API

A RESTful API for a doctor appointment booking platform built with Express.js and MongoDB.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB (Mongoose ODM)
- **Authentication:** JWT + bcrypt
- **Email:** Nodemailer (Gmail SMTP)
- **Deployment:** Render

## Features

- User signup/login with JWT authentication
- Doctor search with speciality and location filters
- Paginated search results
- Slot-based appointment booking system
- Automatic slot generation from doctor availability windows
- Past slot filtering (IST timezone aware)
- Double booking prevention
- Booking cancellation
- Email notifications with calendar (.ics) invites to both patient and doctor

## Project Structure

```
server/
├── index.js                 # Entry point — Express setup, middleware, route mounting
├── middleware/
│   └── auth.js              # JWT verification middleware for protected routes
├── models/
│   ├── user.model.js        # Patient schema — name, email, hashed password
│   ├── doctor.model.js      # Doctor schema — profile, speciality (enum), rating
│   └── slot.model.js        # Slot schema — date, time, status, booking reference
├── routes/
│   ├── auth.routes.js       # POST /signup, POST /login
│   ├── doctor.routes.js     # GET /doctors (search), GET /doctors/:id, GET /specialities
│   └── slot.routes.js       # Slot CRUD — availability, booking, cancellation, my-bookings
├── scripts/
│   └── seed.js              # Seeds 10 doctors with 6 days of availability slots
├── utils/
│   └── email.js             # Email templates and .ics calendar invite generation
└── .env                     # Environment variables (not committed)
```

## API Endpoints

### Auth
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/signup` | Create account | No |
| POST | `/api/auth/login` | Login and get token | No |

### Doctors
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/doctors` | Search doctors (query: speciality, location, page, limit) | No |
| GET | `/api/doctors/specialities` | Get list of valid specialities | No |
| GET | `/api/doctors/:id` | Get full doctor profile | No |

### Slots
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/slots/availability` | Create slots from a time range | No |
| GET | `/api/slots/:doctorId?date=YYYY-MM-DD` | Get slots for a doctor on a date | No |
| POST | `/api/slots/:slotId/book` | Book a slot | Yes |
| POST | `/api/slots/:slotId/cancel` | Cancel a booking | Yes |
| GET | `/api/slots/user/my-bookings` | Get logged-in user's bookings | Yes |

## Database Design

Three collections with the following relationships:

```
User (patients)
  └── referenced by Slot.bookedBy

Doctor (profiles)
  └── referenced by Slot.doctor

Slot (appointments)
  ├── doctor    → ObjectId ref to Doctor
  ├── bookedBy  → ObjectId ref to User (null if available)
  └── status    → "available" | "booked" | "cancelled"
```

**Indexes:**
- `{ doctor: 1, date: 1 }` — compound index for fast slot lookups by doctor + date
- `{ bookedBy: 1 }` — index for fast "my bookings" queries

## Setup

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (or local MongoDB)

### Installation

```bash
git clone https://github.com/mayankek01/docbook-server.git
cd docbook-server
npm install
```

### Environment Variables

Create a `.env` file in the root:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
SMTP_EMAIL=your_email@gmail.com
SMTP_PASSWORD=your_gmail_app_password
FRONTEND_URL=https://your-frontend-domain.vercel.app
```

### Seed the Database

```bash
npm run seed
```

This creates 10 doctors with slots for the next 6 days.

### Run

```bash
npm run dev
```

Server starts on `http://localhost:5000`.

## Edge Cases Handled

- **Past slot filtering:** Slots that have already passed today are not shown (IST timezone aware)
- **Past booking prevention:** API rejects booking attempts for past dates/times even via direct API calls
- **Double booking prevention:** Checks slot status before booking — concurrent requests are handled
- **Duplicate slot prevention:** Availability endpoint checks for existing slots before creating
- **Data privacy:** Search results exclude doctor contact info; slot responses exclude bookedBy and patientNotes
- **Route ordering:** `/user/my-bookings` is defined before `/:doctorId` to prevent Express param collision
- **Email failure isolation:** Email sending is fire-and-forget — SMTP failures don't break the booking flow