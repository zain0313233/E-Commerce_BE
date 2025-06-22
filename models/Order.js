const Sequelize = require("./../config/db");
const { DataTypes } = require("sequelize");

const Order = Sequelize.define(
  "Order",
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id"
      }
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "products",
        key: "id"
      }
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1
      }
    },
    shipping_address: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    payment_method: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [["credit_card", "debit_card", "paypal", "cash_on_delivery", "bank_transfer"]]
      }
    },
    total_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "pending",
      validate: {
        isIn: [["pending", "processing", "shipped", "delivered", "cancelled"]]
      }
    },
    ordered_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    tableName: "orders",
    timestamps: false,
    schema: "ecommerce"
  }
);

module.exports = { Order };