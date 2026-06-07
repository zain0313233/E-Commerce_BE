const { Product } = require("../models/Product");
const { buildProductListWhere, buildProductListOrder } = require("./productListQuery");

const HELP_TOPICS = {
  shipping: {
    title: "Shipping",
    body: "We offer free shipping on orders over $75. Standard delivery times vary by seller and location.",
  },
  returns: {
    title: "Returns",
    body: "You can request a free return within 30 days on eligible items. Check your order in the buyer portal for return status.",
  },
  checkout: {
    title: "Checkout & payment",
    body: "Checkout is secured with Stripe. Your card details are never stored on our servers.",
  },
  seller: {
    title: "Chat with a seller",
    body: "For questions about a specific listing, open the product and use “Chat with seller” — or go to Messages in your buyer portal after signing in.",
  },
};

function salePrice(price, discountPct) {
  const p = parseFloat(price || 0);
  const d = parseFloat(discountPct || 0);
  if (d > 0) return Math.round(p * (1 - d / 100) * 100) / 100;
  return p;
}

function formatProduct(row) {
  const price = parseFloat(row.price || 0);
  const discount = parseFloat(row.discount_percentage || 0);
  const stock = parseInt(row.stock_quantity, 10) || 0;
  return {
    id: row.id,
    title: row.title,
    price,
    salePrice: salePrice(price, discount),
    discount_percentage: discount,
    category: row.category,
    brand: row.brand,
    image_url: row.image_url || row.thumbnail_url,
    stock_quantity: stock,
    inStock: stock > 0,
    rating: row.rating != null ? parseFloat(row.rating) : null,
    user_id: row.user_id,
  };
}

function parseMaxPrice(text) {
  const lower = text.toLowerCase();
  const patterns = [
    /under\s*\$?\s*(\d+)/i,
    /below\s*\$?\s*(\d+)/i,
    /less than\s*\$?\s*(\d+)/i,
    /max\s*\$?\s*(\d+)/i,
    /budget\s*\$?\s*(\d+)/i,
    /\$?\s*(\d+)\s*or less/i,
  ];
  for (const re of patterns) {
    const m = lower.match(re);
    if (m) return parseFloat(m[1]);
  }
  return null;
}

function extractSearchTerms(message) {
  const stop = new Set([
    "i", "me", "my", "want", "need", "looking", "for", "find", "show", "get",
    "the", "a", "an", "some", "please", "can", "you", "help", "with", "under",
    "below", "less", "than", "about", "product", "products", "item", "items",
    "buy", "shop", "search",
  ]);
  const words = String(message || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w));
  return words.join(" ").trim() || String(message || "").trim().slice(0, 80);
}

function detectIntent(message) {
  const lower = message.toLowerCase();
  if (/^(hi|hello|hey|salam|assalam)/i.test(lower.trim())) return "greeting";
  if (/ship|deliver|delivery|free shipping/i.test(lower)) return "help_shipping";
  if (/return|refund/i.test(lower)) return "help_returns";
  if (/pay|checkout|stripe|secure/i.test(lower)) return "help_checkout";
  if (/seller|human|talk to|contact seller/i.test(lower)) return "help_seller";
  if (/track order|my order|order status/i.test(lower)) return "order_hint";
  return "search";
}

async function searchProducts({ search, maxPrice, limit = 6 }) {
  const where = buildProductListWhere({ search, maxPrice });
  const rows = await Product.findAll({
    where,
    order: buildProductListOrder("rating"),
    limit: Math.min(limit, 8),
    attributes: [
      "id",
      "title",
      "price",
      "discount_percentage",
      "category",
      "brand",
      "image_url",
      "thumbnail_url",
      "stock_quantity",
      "rating",
      "user_id",
    ],
  });
  return rows.map(formatProduct);
}

async function getProductById(id) {
  const row = await Product.findByPk(id, {
    attributes: [
      "id",
      "title",
      "description",
      "price",
      "discount_percentage",
      "category",
      "brand",
      "image_url",
      "thumbnail_url",
      "stock_quantity",
      "rating",
      "user_id",
    ],
  });
  if (!row) return null;
  return { ...formatProduct(row), description: row.description };
}

async function maybeEnhanceReply({ userMessage, draftReply, products, product }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return draftReply;

  const context = {
    products: products?.slice(0, 4).map((p) => ({
      id: p.id,
      title: p.title,
      salePrice: p.salePrice,
      inStock: p.inStock,
      category: p.category,
    })),
    product: product
      ? {
          id: product.id,
          title: product.title,
          salePrice: product.salePrice,
          description: product.description?.slice(0, 400),
        }
      : null,
  };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 400,
        messages: [
          {
            role: "system",
            content:
              "You are CommerceAI shopping assistant. Be concise, friendly, and helpful. " +
              "Only mention products and prices from the provided JSON context — never invent SKUs or prices. " +
              "If no products match, suggest refining the search. Max 3 short paragraphs.",
          },
          {
            role: "user",
            content: `User: ${userMessage}\n\nContext JSON:\n${JSON.stringify(context)}\n\nDraft reply to polish:\n${draftReply}`,
          },
        ],
      }),
    });

    if (!res.ok) return draftReply;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || draftReply;
  } catch {
    return draftReply;
  }
}

async function handleSupportChat({
  message,
  productContextId = null,
  history = [],
}) {
  const text = String(message || "").trim();
  if (!text) {
    return {
      reply: "Please type a message — for example: “wireless earbuds under $50”.",
      products: [],
      actions: [],
    };
  }

  const intent = detectIntent(text);
  let reply = "";
  let products = [];
  let actions = [];
  let product = null;

  if (productContextId) {
    product = await getProductById(productContextId);
  }

  if (intent === "greeting") {
    reply =
      "Hi! I'm your CommerceAI shopping assistant. Tell me what you're looking for — brand, category, or budget — and I'll find products and open pages for you.";
    actions = [
      { type: "chip", label: "Deals under $50" },
      { type: "chip", label: "Shoes" },
      { type: "chip", label: "Electronics" },
    ];
  } else if (intent.startsWith("help_")) {
    const key = intent.replace("help_", "");
    const topic = HELP_TOPICS[key];
    reply = topic ? `${topic.title}: ${topic.body}` : HELP_TOPICS.seller.body;
  } else if (intent === "order_hint") {
    reply =
      "To track an order, sign in and open your Buyer portal → Orders. I can help you find products to buy — what are you shopping for today?";
    actions = [{ type: "link", label: "Go to buyer orders", href: "/buyer/orders" }];
  } else {
    const maxPrice = parseMaxPrice(text);
    const search = extractSearchTerms(text);
    products = await searchProducts({
      search: search.length >= 2 ? search : text.slice(0, 60),
      maxPrice: maxPrice != null ? maxPrice : undefined,
      limit: 6,
    });

    if (products.length === 0 && product) {
      reply = `Here's what I know about **${product.title}** — $${product.salePrice}${product.inStock ? ", in stock" : ", currently out of stock"}.`;
      if (product.rating) reply += ` Rating: ${product.rating}/5.`;
      reply += " Open the product page for full details or chat with the seller if you're signed in.";
      products = [product];
      actions = [
        { type: "open_product", productId: product.id, label: "View product" },
      ];
      if (product.user_id) {
        actions.push({
          type: "seller_chat",
          sellerId: product.user_id,
          productId: product.id,
          label: "Chat with seller",
        });
      }
    } else if (products.length === 0) {
      reply =
        "I couldn't find matching products. Try different keywords — e.g. “running shoes” or “headphones under 40”.";
    } else if (products.length === 1) {
      const p = products[0];
      reply = `I found a great match: **${p.title}** for $${p.salePrice}${p.inStock ? " (in stock)" : ""}. Tap below to view it.`;
      actions = [
        { type: "open_product", productId: p.id, label: "View product" },
        { type: "link", label: "Browse all products", href: "/allproducts" },
      ];
    } else {
      reply = `I found ${products.length} products that match. Here are the top picks — tap any card to open it.`;
      if (maxPrice != null) reply += ` (under $${maxPrice})`;
      actions = [{ type: "link", label: "See more in shop", href: `/allproducts${search ? `?search=${encodeURIComponent(search)}` : ""}` }];
    }
  }

  if (intent === "search" && products.length > 0) {
    reply = await maybeEnhanceReply({ userMessage: text, draftReply: reply, products, product });
  }

  return {
    reply,
    products,
    actions,
    intent,
    usedAi: Boolean(process.env.OPENAI_API_KEY && intent === "search"),
  };
}

module.exports = {
  handleSupportChat,
  searchProducts,
  getProductById,
  HELP_TOPICS,
};
