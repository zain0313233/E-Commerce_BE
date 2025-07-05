const Sequelize = require('./../config/db');
const { DataTypes } = require('sequelize');

const Product = Sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  discount_percentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true
  },
  category: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  brand: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  image_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  thumbnail_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  stock_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  rating: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: true,
    validate: {
      min: 0,
      max: 5
    }
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'References user who created this product. Null for scraped products from external APIs'
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'products',
  timestamps: false,
  schema: 'ecommerce',
});

module.exports = {
  Product
};