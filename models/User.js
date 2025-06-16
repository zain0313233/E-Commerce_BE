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
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at' 
    },
    is_supabase_user: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Indicates if user is using Supabase auth'
    },
    supabase_id: {
        type: DataTypes.UUID,
        allowNull: true,
        unique: true,
        comment: 'Links to Supabase auth.users.id'
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
        }
    ]
});

module.exports = {
    User
};