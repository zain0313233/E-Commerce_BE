const express = require("express");
const router = express.Router();
const {Order}=require('../models/Order');
router.post('/create-order',async(req,res)=>{
    try{
        const {
        user_id,
        product_id,
        total_price,
        status,
        }=req.body;
        if(!user_id || !product_id){
          return res.status(400).json({
            message:"user id and product id require",
          })
        }
        const newOrder=await Order.create({
        user_id :user_id,
        product_id:product_id,
        total_price:total_price,
        status:status,
        ordered_at:new Date(),

        })
        if(newOrder){
            console.log('Order created')
        }
        return res.status(201).json({
            message:"order created succesfully",
            order:newOrder,
        })

    }catch(error){
        console.error('Error Occure',error)
    }

});
router.get('/get-orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        message: 'User ID required'
      });
    }

    const orders = await Order.findAll({
      where: { user_id: id }
    });

    if (!orders || orders.length === 0) {
      return res.status(404).json({
        message: 'No orders found for this user',
        orders: []
      });
    }

    return res.status(200).json({
      message: "Orders retrieved successfully",
      orders: orders
    });

  } catch (error) {
    console.error('Error occurred:', error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});
router.get('/get-order', async (req, res) => {
  try {
    const { order_id, user_id } = req.query;

    if (!user_id || !order_id) {
      return res.status(400).json({
        message: 'User ID and Order ID required'
      });
    }

    const order = await Order.findOne({
      where: { 
        user_id: user_id,
        id: order_id 
      }
    });

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
        order: null
      });
    }

    return res.status(200).json({
      message: "Order retrieved successfully",
      order: order
    });

  } catch (error) {
    console.error('Error occurred:', error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});
module.exports=router;