require('dotenv').config();
const express =require('express');
const { testConnection } = require("./database/index");
require("dotenv").config();

const app=express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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