require('dotenv').config();
const cors = require('cors');
const express =require('express');
const { testConnection } = require("./database/index");
const Productroutes=require('./routes/productrotes');
const authroutes = require('./routes/authroutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes =require('./routes/paymentRoutes.js');
const {getshippedOrders,UpdateOrder}=require('./controller/ordertraking.js');
const {getproductfromcsv}=require('./controller/getproducts.js')
const { parseWebhookBody, rateLimitPayments } = require ('./middleware/stripe.js');
require("dotenv").config();

const app=express();
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'], 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(parseWebhookBody);
app.use('/api/auth',authroutes);
app.use('/api/payments', rateLimitPayments(), paymentRoutes);
app.use('/api/cart',cartRoutes);
app.use('/api/order',orderRoutes);
app.use('/api/product',Productroutes);
// UpdateOrder();
// getshippedOrders();
getproductfromcsv();
app.use('/api/health',(req,res)=>{
    res.status(200).json({
        status:"ok",
        message:"Server is Running"
    })
})
testConnection();
const PORT = process.env.PORT || 3001;
app.listen(PORT,()=>{
    console.log(`Server is running on port ${PORT}`);
})
module.exports = app;