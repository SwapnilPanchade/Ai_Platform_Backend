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
