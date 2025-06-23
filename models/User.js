const Sequelize = require('./../config/db');
const { DataTypes } = require('sequelize');

const User = Sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [1, 100]
        }
    },
    email: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true,
            notEmpty: true
        }
    },
    password: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: {
            customPasswordValidation(value) {
                if (value !== null && value !== undefined) {
                    if (value.length < 6) {
                        throw new Error('Password must be at least 6 characters long');
                    }
                    if (value.length > 255) {
                        throw new Error('Password must be less than 255 characters');
                    }
                }
            }
        }
    },
    role: {
        type: DataTypes.STRING(20),
        defaultValue: 'customer',
        allowNull: false,
        validate: {
            isIn: [['customer', 'admin', 'seller', 'moderator', 'support']]
        }
    },
    address_line_1: {
        type: DataTypes.STRING(255),
        allowNull: true,
        validate: {
            len: [0, 255]
        }
    },
    address_line_2: {
        type: DataTypes.STRING(255),
        allowNull: true,
        validate: {
            len: [0, 255]
        }
    },
    city: {
        type: DataTypes.STRING(100),
        allowNull: true,
        validate: {
            len: [0, 100]
        }
    },
    state: {
        type: DataTypes.STRING(100),
        allowNull: true,
        validate: {
            len: [0, 100]
        }
    },
    postal_code: {
        type: DataTypes.STRING(20),
        allowNull: true,
        validate: {
            len: [0, 20]
        }
    },
    country: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'Pakistan',
        validate: {
            len: [0, 100]
        }
    },
    phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
        validate: {
            len: [0, 20]
        }
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
    },
    is_supabase_user: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    supabase_id: {
        type: DataTypes.UUID,
        allowNull: true,
        unique: true
    }
}, {
    tableName: 'users',
    timestamps: false,
    schema: 'ecommerce',
    indexes: [
        {
            unique: true,
            fields: ['email']
        },
        {
            unique: true,
            fields: ['supabase_id']
        },
        {
            fields: ['role']
        },
        {
            fields: ['is_supabase_user']
        },
        {
            fields: ['country']
        },
        {
            fields: ['city']
        }
    ]
});

module.exports = {
    User
};