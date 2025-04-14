# 🛡️ Role-Based Authentication API with JWT – TypeScript + Express

This is a backend API built with **TypeScript**, **Express**, **MongoDB**, and **JWT** that supports **role-based access control**. Users can register, log in, and access protected routes depending on their role.

---

## 📦 Tech Stack

- Node.js
- Express
- TypeScript
- MongoDB + Mongoose
- JSON Web Tokens (JWT)
- Dotenv

---

## 🚀 Getting Started

### 1. Clone the Repo

```bash
git clone <your-repo-url>
cd backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create a `.env` File

Inside the `backend` folder, or use the a `.env` file provided in the project with the following:

```
PORT=5000
MONGO_URI=<your_mongo_uri>
JWT_SECRET=super_secret_key
```

### 4. Run the Server

```bash
npm run dev
```

## 🛠️ Project Structure

```
backend/
├── src/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── validators/
│   ├── types/
│   └── server.ts
├── .env
├── package.json
├── tsconfig.json
|-- docker-compose.yml
└── ...
```

## 📮 API Endpoints

### ✅ Public Routes

| Method | Route                | Description             |
| ------ | -------------------- | ----------------------- |
| POST   | `/api/auth/register` | Register a user         |
| POST   | `/api/auth/login`    | Login and get JWT token |

#### 📥 Register Request Body

```json
{
  "email": "admin@gmail.com",
  "password": "12345678",
  "firstName": "John",
  "lastName": "Doe",
  "role": "admin"
}
```

#### 📥 Login Request Body

```json
{
  "email": "admin@gmail.com",
  "password": "12345678"
}
```

### 🔒 Protected Routes (Require JWT Token)

Attach this header to all protected routes:

```
Authorization: Bearer <your_jwt_token>
```

### 👤 User Routes

| Method | Route               | Access    | Description           |
| ------ | ------------------- | --------- | --------------------- |
| GET    | `/api/user/profile` | All roles | Get logged-in profile |

#### ✅ Sample Response

```json
{
  "message": "User profile fetched",
  "user": {
    "_id": "66165acbf20fd764b18aeb22",
    "email": "admin@gmail.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "admin"
  }
}
```

### 🛠 Admin Routes

| Method | Route                  | Access     | Description            |
| ------ | ---------------------- | ---------- | ---------------------- |
| GET    | `/api/admin/dashboard` | Admin only | Access admin dashboard |

## 🧪 Postman Token Usage

After login, use this in headers:

```
Authorization: Bearer <paste_your_token_here>
```

Example:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

## ⚠️ Notes

- ✅ Make sure `.env` is placed inside the `backend/` directory.
- ✅ JWT_SECRET must match in both token generation and validation.
- ✅ MongoDB should be running (local or Atlas).
- 🔁 Use `npm run dev` for development mode with hot reloading.
- 🔒 Use roles like `admin`, `pro`, `free` when registering,by def it's a free user

## 💳 Testing Stripe Integration

**Step 8: Testing**

1. **Run Backend:** Start your Node.js server.
2. **Run Stripe CLI:** stripe listen --forward-to localhost:5001/webhooks/stripe (use the correct port/path). Copy the whsec\_... secret into your .env file and restart the backend if needed.
3. **Use Postman (or similar):**

   - **Register/Login:** Get an auth token for a test user.
   - **Create Checkout:** POST /api/payments/create-checkout-session (with Auth header). Copy the sessionId.
   - **Simulate Payment:** In a browser, go to https://checkout.stripe.com/pay/{sessionId} (replace {sessionId} with the ID you got). Use Stripe's test card numbers (like 4242 4242 4242 4242, any future date, any 3-digit CVC). Complete the checkout.
   - **Check Webhooks:** Look at the Stripe CLI output. You should see events like checkout.session.completed, invoice.created, invoice.paid, customer.subscription.created. Check your backend console logs for ✅ Stripe Webhook Received....
   - **Check Database:** Verify the user document in MongoDB now has stripeCustomerId, stripeSubscriptionId, stripeSubscriptionStatus: 'pro', and role: 'pro'.
   - **Cancel Subscription:** POST /api/payments/cancel-subscription (with Auth header).
   - **Check Webhooks:** Look for customer.subscription.updated event (with cancel_at_period_end: true).
   - **Check Database:** User status shouldn't change immediately if you used cancel_at_period_end.
   - **(Advanced Test):** You can use the Stripe dashboard (in test mode) to manually advance time or trigger specific subscription events to test failures or end-of-period cancellations.

   - \*\*ADD YOUR STRIPE KEY AND VALUES TO INTEGRATE THE STRIPE

# Testing Email Functionality with Ethereal

## Step 6: Testing with Ethereal

1. Make sure NODE_ENV is set to production add you have modified the production variables as well in .env file you have provided

```
📧 Using Ethereal for email testing.
 ethereal user: xxxxxxxxxxxxxxxx@ethereal.email
 ethereal password: xxxxxxxxxxxxx
📧 Ethereal transporter created.
```

3. Use Postman or your frontend to register a new user.

4. Check the backend console logs again. After successful registration, you should see:

```
📧 Email sent: <message_id_string>
✉️ Preview URL: https://ethereal.email/message/xxxxxxxxxxxxxxxxxxxx
```

5. **Copy the "Preview URL" and paste it into your browser.** You should see the welcome email rendered as it would appear in an email client.

## Implemented the log cleaning job part

## ⚙️ Configuration

- The primary configuration for `agenda` resides in `src/config/agenda.ts`.
- It connects to the MongoDB database specified by the `MONGO_URI` environment variable (defined in `.env`).
- `agenda` creates and manages its own collection in MongoDB (default: `agendaJobs`) to store job state and history.
- Graceful shutdown logic is included in `config/agenda.ts` to stop Agenda cleanly when the server process terminates (SIGTERM, SIGINT).

## 🚀 How it Works

1.  **Initialization:** The `agenda` instance is configured and initialized in `src/config/agenda.ts`.
2.  **DB Connection:** Agenda establishes its connection to MongoDB. The main application server (`src/server.ts`) waits for the primary database connection (`connectDB`) to succeed before proceeding with Agenda setup.
3.  **Job Definitions:** Specific job logic is defined in files within the `src/jobs/` directory (e.g., `email.jobs.ts`, `cleanup.jobs.ts`). Each file exports a function that takes the `agenda` instance and uses `agenda.define()` to register the job name and its corresponding asynchronous function.
4.  **Registration:** Job definition functions are imported and executed in `src/server.ts` _after_ the successful database connection, registering the jobs with the running `agenda` instance.
5.  **Scheduling:** Recurring jobs are scheduled in `src/server.ts` using `agenda.every()`. This method takes a cron string or a human-readable interval, the job name, optional data, and options (like timezone).
6.  **Execution:** The `agenda` instance periodically checks the database (`processEvery`) for jobs that are due to run. When a job is executed, the corresponding defined function is invoked.
7.  **Asynchronous Tasks:** Jobs defined for immediate execution (e.g., sending emails asynchronously) are scheduled using `agenda.now()` from within the application code (e.g., controllers).

## ✨ Implemented Jobs

- **`send-email`:**
  - **Defined in:** `src/jobs/email.jobs.ts`
  - **Purpose:** Sends emails asynchronously using the `email.service.ts`. Takes email details (to, subject, text, html) as data.
  - **Triggered by:** `agenda.now('send-email', jobData)` calls within the application (e.g., after user registration in `auth.controller.ts`).
- **`cleanup-old-logs`:**
  - **Defined in:** `src/jobs/cleanup.jobs.ts`
  - **Purpose:** Periodically removes old log entries from the `logs` MongoDB collection to prevent it from growing indefinitely. Currently configured to remove logs older than 90 days.
  - **Scheduled:** Runs daily at 3:00 AM UTC (`'0 3 * * *'`).

## ➕ Adding New Scheduled Jobs

1.  Create a new file in `src/jobs/` (e.g., `src/jobs/myNewTask.jobs.ts`).
2.  Import `Agenda`, `Job`, `logger`, `saveLogToDb`, and any necessary models or services.
3.  Define the job data interface (if the job requires specific input data).
4.  Export a default function `defineMyNewTaskJob(agenda: Agenda)`.
5.  Inside this function, call `agenda.define('my-new-task-name', async (job: Job<MyJobDataInterface | undefined>) => { /* job logic here */ });`. Implement the job logic, including logging success/failure with `logger` and `saveLogToDb`.
6.  Import `defineMyNewTaskJob` in `src/server.ts`.
7.  Call `defineMyNewTaskJob(agenda)` in `server.ts` after the DB connection, alongside other job definitions.
8.  If it's a recurring job, add an `await agenda.every(...)` call in `server.ts` within the scheduling block, specifying the interval/cron string and the job name (`'my-new-task-name'`).

## 📊 Monitoring & Tracking

- **Job History:** The execution history, status (success/fail), `lastRunAt`, `nextRunAt`, etc., for all jobs are automatically stored by `agenda` in the `agendaJobs` MongoDB collection.
- **Logging:** Job start, completion, and errors are logged using the centralized Pino logger (`logger`) to the console (and potentially other configured transports). Significant job events or errors are also logged to the `logs` MongoDB collection via `saveLogToDb`.

## 🔮 Future Considerations (Examples Not Implemented in this Phase)

- **Database Backups:** Critical backups are best handled by dedicated database tools (`mongodump`) or cloud provider services, not typically within the application scheduler.
- **Subscription Renewal Checks:** Stripe handles recurring billing; status updates are received via webhooks (Task 4/7). Proactive checks are generally not needed for basic renewal status but could be added later for _expiration warnings_.
- **Email Digests:** Can be easily added as a scheduled job once features generating digest content (new videos, user activity) are implemented.
