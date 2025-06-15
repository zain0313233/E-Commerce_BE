require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize (
    process.env.POSTGRE_DATABASE,
    process.env.POSTGRE_USER,
    process.env.POSTGRE_PASSWORD,
    {
        host:process.env.POSTGRE_HOST,
        port:process.env.POSTGRE_PORT,
        dialect:"postgres",
        dialectOptions:{
             ssl: false
        },
        define:{
            schema:"ecommerce"
        }
    }
)
module.exports = sequelize;