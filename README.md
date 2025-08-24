# 🛒 E-Commerce Backend API

This is a fully functional Node.js + Express.js backend for an eCommerce platform, built with PostgreSQL and designed to handle product management, user authentication, shopping cart, and order processing. Ideal for portfolio, learning, or expanding into a full-stack application.
s
---

## 🚀 Features

- 🛍 Product management (CRUD)
- 👤 User registration & login
- 🔐 Password hashing with Subpass authentication
- 🛒 Add to cart, update, delete items
- 📦 Order creation and order history
- ⭐ Product reviews with ratings
- 🗂 Image hosting via BunnyCDN
- 🧾 PostgreSQL relational database

---

## 🧰 Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL
- **Authentication:** Subpass
- **ORM:** pg / node-postgres
- **Image Hosting:** Bunny CDN
- **Dev Tools:** dotenv, nodemon, bcrypt

---

## Getting Started

1. Clone the repository:
    ```bash
    git clone https://github.com/zain0313233/E-Commerce_BE.git
    ```
2. Install dependencies:
    ```bash
    npm install
    ```
3. Set up environment variables (see `.env.example`).
4. Start the server:
    ```bash
    npm run dev
    ```
🚀 Running the Project with Docker
1️⃣ Build the Docker Image

First, create the Docker image for the backend:

docker build -t ecommerce_be .

2️⃣ Run the Docker Container

You can run the container in two ways:

🔹 Option 1: Without Volume Mounts (simple run)

This method runs the container directly from the image. Use it when you don’t plan to change the source code frequently.

docker run --rm -p 3001:3001 ecommerce_be

🔹 Option 2: With Volume Mounts (development mode)

This method mounts your local project folder inside the container, so any code changes are reflected instantly without rebuilding the image.

docker run --rm -p 3001:3001 -v "F:/My Projects/E-Commerce_BE:/app" -v /app/node_modules ecommerce_be


💡 Why use volumes?

Keeps node_modules inside the container (avoiding conflicts with your host machine).

Speeds up development by eliminating the need to rebuild the image after every code update.

✅ With this setup, your backend runs on http://localhost:3001 and is ready for development