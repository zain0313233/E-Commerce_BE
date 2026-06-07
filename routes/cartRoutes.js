const express = require("express");
const router = express.Router();
const { CartItem } = require("../models/CartItem");
const { Product } = require("../models/Product");
const { authenticateToken } = require("../middleware/auth");
const { unitPrice } = require("../services/pricing");

router.use(authenticateToken);

router.post("/add-to-cart", async (req, res) => {
  try {
    const { product_id, quantity = 1 } = req.body;
    const user_id = req.user.id;

    if (!product_id) {
      return res.status(400).json({ message: "product_id is required" });
    }

    const product = await Product.findByPk(product_id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    if (product.stock_quantity < qty) {
      return res.status(400).json({
        message: `Only ${product.stock_quantity} in stock`,
      });
    }

    const existing = await CartItem.findOne({
      where: { user_id, product_id },
    });

    if (existing) {
      const newQty = existing.quantity + qty;
      if (product.stock_quantity < newQty) {
        return res.status(400).json({
          message: `Cannot add more than ${product.stock_quantity} units`,
        });
      }
      existing.quantity = newQty;
      await existing.save();
      return res.status(200).json({
        message: "Cart updated",
        cartItem: existing,
      });
    }

    const newCart = await CartItem.create({
      user_id,
      product_id,
      quantity: qty,
      added_at: new Date(),
    });

    return res.status(201).json({
      message: "Added to cart",
      cartItem: newCart,
    });
  } catch (error) {
    console.error("add-to-cart", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

async function getEnrichedCart(userId) {
  const cartitems = await CartItem.findAll({
    where: { user_id: userId },
    order: [["added_at", "DESC"]],
  });

  if (!cartitems.length) {
    return { cartitems: [], subtotal: 0, itemCount: 0 };
  }

  const productIds = cartitems.map((c) => c.product_id);
  const products = await Product.findAll({ where: { id: productIds } });
  const byId = new Map(products.map((p) => [p.id, p]));

  let subtotal = 0;
  let itemCount = 0;

  const enriched = cartitems.map((row) => {
    const product = byId.get(row.product_id);
    const plain = row.toJSON();
    if (product) {
      const price = unitPrice(product);
      subtotal += price * row.quantity;
      itemCount += row.quantity;
      plain.product = {
        id: product.id,
        title: product.title,
        description: product.description,
        image_url: product.image_url,
        category: product.category,
        brand: product.brand,
        price: product.price,
        discount_percentage: product.discount_percentage,
        stock_quantity: product.stock_quantity,
        rating: product.rating,
        unit_price: price,
      };
    } else {
      plain.product = null;
    }
    return plain;
  });

  return { cartitems: enriched, subtotal, itemCount };
}

router.get("/me", async (req, res) => {
  try {
    const payload = await getEnrichedCart(req.user.id);
    return res.status(200).json(payload);
  } catch (error) {
    console.error("cart/me", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/get-all-cart/:id", async (req, res) => {
  try {
    if (String(req.params.id) !== String(req.user.id)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const payload = await getEnrichedCart(req.user.id);
    return res.status(200).json({
      message: "Cart retrieved",
      ...payload,
    });
  } catch (error) {
    console.error("get-all-cart", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/merge-guest", async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || !items.length) {
      return res.status(200).json({ message: "Nothing to merge", merged: 0 });
    }

    let merged = 0;
    for (const entry of items) {
      const product_id = entry.product_id || entry.productId;
      const quantity = Math.max(1, parseInt(entry.quantity, 10) || 1);
      if (!product_id) continue;

      const product = await Product.findByPk(product_id);
      if (!product || product.stock_quantity < 1) continue;

      const existing = await CartItem.findOne({
        where: { user_id: req.user.id, product_id },
      });

      if (existing) {
        const newQty = Math.min(
          existing.quantity + quantity,
          product.stock_quantity
        );
        existing.quantity = newQty;
        await existing.save();
      } else {
        await CartItem.create({
          user_id: req.user.id,
          product_id,
          quantity: Math.min(quantity, product.stock_quantity),
          added_at: new Date(),
        });
      }
      merged += 1;
    }

    return res.status(200).json({ message: "Guest cart merged", merged });
  } catch (error) {
    console.error("merge-guest", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/remove-item/:id", async (req, res) => {
  try {
    const cartItem = await CartItem.findByPk(req.params.id);
    if (!cartItem) {
      return res.status(404).json({ message: "Cart item not found" });
    }
    if (cartItem.user_id !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await cartItem.destroy();
    return res.status(200).json({ message: "Removed" });
  } catch (error) {
    console.error("remove-item", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/update-quantity", async (req, res) => {
  try {
    const { cart_id, quantity } = req.body;
    if (!cart_id || !quantity || quantity < 1) {
      return res.status(400).json({ message: "cart_id and quantity required" });
    }

    const cartItem = await CartItem.findByPk(cart_id);
    if (!cartItem) {
      return res.status(404).json({ message: "Cart item not found" });
    }
    if (cartItem.user_id !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const product = await Product.findByPk(cartItem.product_id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (quantity > product.stock_quantity) {
      return res.status(400).json({
        message: `Only ${product.stock_quantity} available`,
      });
    }

    cartItem.quantity = quantity;
    await cartItem.save();

    return res.status(200).json({ message: "Updated", cartItem });
  } catch (error) {
    console.error("update-quantity", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/clear", async (req, res) => {
  await CartItem.destroy({ where: { user_id: req.user.id } });
  return res.status(200).json({ message: "Cart cleared" });
});

module.exports = router;
