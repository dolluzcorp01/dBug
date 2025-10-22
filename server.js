const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

const app = express();
const port = 4004;

// ✅ Middleware for CORS - Allow specific origins
const allowedOrigins = [
    'http://localhost:3000',   // Allow React frontend
    'https://dbug.dolluzcorp.in',   // Production URL
    'http://127.0.0.1:3000',   // Allow localhost if accessing via 127.0.0.1
    'http://localhost:4004',     // Allow backend server origin (no trailing slash)
    'https://dbug.dolluzcorp.in:3000' // Extra frontend url
];

// Enable CORS with the allowed origins and credentials
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) {
            callback(null, origin); // <-- ✅ return origin instead of true
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// ✅ Middleware for parsing JSON and reading HTTP-only cookies
app.use(express.json());
app.use(cookieParser());

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));
app.use(cookieParser());

// Routes
const TictesRoutes = require('./src/backend_routes/Tickets_server');

app.use("/api/tickets", TictesRoutes);

// Serve uploaded files if needed
app.use('/Tickets_file_uploads', express.static(path.join(__dirname, 'Tickets_file_uploads')));

app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});
