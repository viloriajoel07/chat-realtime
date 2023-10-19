import express from "express";
import logger from "morgan";
import dotenv from "dotenv";
import { createClient } from "@libsql/client";

import { Server } from "socket.io";
import { createServer } from "http";

// Load environment variables
dotenv.config();

// Express
const app = express();

// Server
const port = process.env.PORT ?? 3000;
const server = createServer(app);
const io = new Server(server);

// LibSQL
const db = createClient({
  url: "libsql://bright-nightstar-viloriajoel07.turso.io",
  authToken: process.env.DB_TOKEN,
});

await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT,
        user TEXT
    )
`);

// Socket.io
io.on("connection", async (socket) => {
  console.log("a user connected");

  //   socket join room
  socket.on("chat message", async (msg) => {
    let result;
    const username = socket.handshake.auth.username ?? "Anonymous";
    try {
      result = await db.execute({
        sql: "INSERT INTO messages (content, user) VALUES (:msg, :username)",
        args: { msg, username },
      });
    } catch (err) {
      console.error(err);
      return;
    }
    io.emit("chat message", msg, result.lastInsertRowid.toString(), username);
  });

  // recover messages
  if (!socket.recovered) {
    try {
      const results = await db.execute({
        sql: "SELECT id, content, user FROM messages WHERE id > ?",
        args: [socket.handshake.auth.serverOffset ?? 0],
      });

      results.rows.forEach((row) => {
        console.log(row);
        socket.emit("chat message", row.content, row.id.toString(), row.user);
      });
    } catch (err) {
      console.error(err);
    }
  }

  //   socket disconnected
  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

app.use(logger("dev"));

app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/client/index.html");
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
