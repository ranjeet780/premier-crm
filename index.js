  const mongoose = require('mongoose');
  const http = require("http");
  const { initSocket } = require("./socket");
  const cors = require('cors');
  const express = require('express');
  require('dotenv').config();
  require("./cronJobs/monthlySalaryCron");
  require("./cronJobs/autoAbsentCron");
  require("./cronJobs/autoLeaveMarkCron");
  require("./cronJobs/serviceSubscriptionReminderCron");
  //neeww add
  // const { initSocket } = require("./socket");
const notificationRoutes = require("./Routes/notificationRoutes");
const notificationForAllRoutes = require("./Routes/notificationForAllRoutes");

  const path = require('path');
  const chatRoutes = require("./Routes/chat.routes");

  const app = express();
  const isProduction = process.env.NODE_ENV === "production";
  const requiredEnv = ["MONGO_URL", "JWT_SECRET"];
  const missingEnv = requiredEnv.filter((key) => !String(process.env[key] || "").trim());
  if (isProduction && missingEnv.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnv.join(", ")}`);
  }

  const allowedOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const corsOptions = {
    origin(origin, callback) {
      // Allow non-browser requests (curl/postman) and explicitly allowlisted origins.
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  };

  // Middlewares
  app.use(cors(corsOptions));
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use("/uploads", express.static(path.join(process.cwd(), "controller/uploads")));

  const Router = require('./Routes/Routes');
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/notifications-all", notificationForAllRoutes);
  app.use("/api/screenshots", require("./Routes/screenshotRoutes"));
  const normalizePermissions = require("./controller/middleware/normalizePermissions");
  const authMiddleware =require('./controller/middleware/authMiddleware')


  const PORT = process.env.PORT || 5000;
  const URL = process.env.MONGO_URL;

  // MongoDB Connection
  mongoose.connect(URL)
    .then(() => console.log('✅ MongoDB is connected'))
    .catch((err) => console.log('❌ Server Error', err));
    require('./cronJobs/attendanceCron')

// app.use(authMiddleware);
app.use(normalizePermissions);

  // Routes
  app.use('/api', Router);

  app.use("/api/chat", chatRoutes);


  app.get("/", (req, res) => {
    res.send("✅ Backend is live and socket is running!");
  });

  // Create HTTP server (required for socket.io)
  const server = http.createServer(app);

  // Initialize Socket.IO
  initSocket(server);

  // Start server
  server.listen(PORT, () => {
    console.log(`🚀 Server + Socket running on port ${PORT}`);
  });

  
