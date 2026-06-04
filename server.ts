import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import Stripe from "stripe";

let stripe: Stripe | null = null;
const getStripe = () => {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
};

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

  app.post("/api/create-checkout-session", async (req, res) => {
    const { userId, coins, price, packageName } = req.body;
    const stripeInstance = getStripe();

    if (!stripeInstance) {
      return res.status(400).json({ error: "Stripe is not configured. Please add STRIPE_SECRET_KEY in settings." });
    }

    try {
      const session = await stripeInstance.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "vnd",
              product_data: {
                name: `Recharge ${coins} TikTok Coins`,
                description: packageName || `Package for user ${userId}`,
              },
              unit_amount: price, // price is already in VND (no decimals)
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${process.env.APP_URL || "http://localhost:3000"}/?payment_success=true&session_id={CHECKOUT_SESSION_ID}&coins=${coins}&userId=${userId}&price=${price}`,
        cancel_url: `${process.env.APP_URL || "http://localhost:3000"}/?payment_cancel=true`,
        metadata: {
          userId,
          coins: coins.toString(),
          price: price.toString(),
        }
      });

      res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      console.error("Stripe Session Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Verify session endpoint
  app.get("/api/verify-session/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    const stripeInstance = getStripe();

    if (!stripeInstance) {
      return res.status(500).json({ error: "Stripe not configured" });
    }

    try {
      const session = await stripeInstance.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === "paid" && session.metadata) {
        const userId = session.metadata.userId;
        const coins = parseInt(session.metadata.coins);
        const price = parseInt(session.metadata.price);

        // Check if already processed (this is a simple simulation, in production you'd use a DB and webhook)
        // For this demo, we'll just allow it and let the client handle state if needed, 
        // but normally we update DB here.
        if (!users[userId]) users[userId] = { coins: 0, history: [] };
        
        // Prevent double counting if verified multiple times (idempotency)
        const alreadyApplied = users[userId].history.some((h: any) => h.sessionId === sessionId);
        if (!alreadyApplied) {
          users[userId].coins += coins;
          users[userId].history.unshift({
            coins,
            price,
            sessionId,
            date: new Date().toISOString()
          });
          return res.json({ success: true, coins: users[userId].coins });
        }
        
        return res.json({ success: true, coins: users[userId].coins, alreadyProcessed: true });
      }
      res.json({ success: false, status: session.payment_status });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
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
