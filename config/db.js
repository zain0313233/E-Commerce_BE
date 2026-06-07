require('dotenv').config();
const { Sequelize } = require('sequelize');

function normalizeDatabaseUrl(url) {
    if (!url) return url;
    return url
        .replace(/([?&])channel_binding=require&?/g, '$1')
        .replace(/[?&]$/, '');
}

// Option 1: Use DATABASE_URL if provided (Neon connection string)
if (process.env.DATABASE_URL) {
    const sequelize = new Sequelize(normalizeDatabaseUrl(process.env.DATABASE_URL), {
        dialect: "postgres",
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        },
        define: {
            schema: "ecommerce"
        },
        logging: process.env.NODE_ENV === 'development' ? console.log : false
    });
    
    module.exports = sequelize;
} else {
    // Option 2: Use individual environment variables
    const sslEnabled = process.env.POSTGRE_SSL === 'true';
    
    const sequelize = new Sequelize(
        process.env.POSTGRE_DATABASE,
        process.env.POSTGRE_USER,
        process.env.POSTGRE_PASSWORD,
        {
            host: process.env.POSTGRE_HOST,
            port: process.env.POSTGRE_PORT || 5432,
            dialect: "postgres",
            dialectOptions: {
                ssl: sslEnabled ? {
                    require: true,
                    rejectUnauthorized: false
                } : false
            },
            define: {
                schema: "ecommerce"
            },
            logging: process.env.NODE_ENV === 'development' ? console.log : false
        }
    );
    
    module.exports = sequelize;
}