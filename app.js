import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);


app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

const users = {};


function sanitizeUsername(username) {
  if (!username || typeof username !== "string") return "Anonymous";
  const trimmed = username.trim();
  if (trimmed.length === 0) return "Anonymous";
  
  return trimmed.replace(/[^a-zA-Z0-9 _-]/g, "");
}

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  users[socket.id] = { username: null, path: [] };

  socket.on("join", (username) => {
    const safeUsername = sanitizeUsername(username);
    users[socket.id].username = safeUsername;
    io.emit("user-list", users);
    console.log(`${safeUsername} joined`);
  });

  socket.on("send-location", (coords) => {
    if (!users[socket.id]) return;
    const { latitude, longitude } = coords;

    
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return; 
    }

    
    users[socket.id].path.push({
      latitude,
      longitude,
      timestamp: Date.now(),
    });

    const latestPoint = users[socket.id].path[users[socket.id].path.length - 1];

   
    socket.broadcast.emit("receive-location", {
      id: socket.id,
      username: users[socket.id].username,
      ...latestPoint,
    });

    io.emit("user-list", users);
  });

  socket.on("disconnect", () => {
    console.log(`${users[socket.id]?.username || "User"} disconnected`);
    delete users[socket.id];
    io.emit("user-disconnected", socket.id);
    io.emit("user-list", users);
  });
});


app.get("/", (req, res) => {
  res.render("index");
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
