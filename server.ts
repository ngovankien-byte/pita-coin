import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Database giả lập
  let users: Record<string, { coins: number; history: any[] }> = {
    "user1": {
      coins: 0,
      history: []
    }
  };

  // API routes
  app.get("/api/user/:id", (req, res) => {
    const userId = req.params.id;
    if (!users[userId]) {
      users[userId] = { coins: 0, history: [] };
    }
    res.json(users[userId]);
  });

  app.post("/api/buy", (req, res) => {
    const { userId, coins, price } = req.body;
    if (!users[userId]) {
      users[userId] = { coins: 0, history: [] };
    }
    users[userId].coins += coins;
    users[userId].history.unshift({
      coins,
      price,
      date: new Date().toISOString()
    });
    res.json({ success: true });
  });

  app.get("/api/history/:id", (req, res) => {
    const userId = req.params.id;
    res.json(users[userId]?.history || []);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

startServer();
