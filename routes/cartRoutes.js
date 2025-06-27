const express = require("express");
const router = express.Router();
const {CartItem}=require('../models/CartItem');
router.post('/add-to-cart',async(req,res)=>{
    try{
        const {
        user_id,
        product_id,
        quantity,
        }=req.body;
        if(!user_id || !product_id){
          return res.status(400).json({
            message:"user id and product id require",
          })
        }
        const newCart=await CartItem.create({
        user_id :user_id,
        product_id:product_id,
        quantity:quantity,
        added_at:new Date(),

        })
        if(newCart){
            console.log('Cart Added')
        }
        return res.status(201).json({
            message:"Cart Added succesfully",
            Cart:newCart,
        })

    }catch(error){
        console.error('Error Occure',error)
    }

});

router.get('/get-all-cart/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        message: 'User ID required'
      });
    }

    const cartitems = await CartItem.findAll({
      where: { user_id: id }
    });

    if (!cartitems || cartitems.length === 0) {
      return res.status(404).json({
        message: 'No orders found for this user',
        cartitems: []
      });
    }

    return res.status(200).json({
      message: "Orders retrieved successfully",
      cartitems: cartitems
    });

  } catch (error) {
    console.error('Error occurred:', error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});
router.delete('/remove-item/:id', async (req, res) => {
  try {
      const { id } = req.params;

      if (!id) {
          return res.status(400).json({
              message: "Cart Item ID required"
          });
      }

      const cartItem = await CartItem.findByPk(id);

      if (!cartItem) {
          return res.status(404).json({
              message: "Cart item not found"
          });
      }

      await cartItem.destroy();

      return res.status(200).json({
          message: "Cart item removed successfully"
      });

  } catch (error) {
      console.error('Error Occure', error);
      return res.status(500).json({
          message: "Internal server error",
          error: error.message
      });
  }
});

router.put('/update-quantity', async (req, res) => {
  try {
      const { cart_id, quantity } = req.body;

      if (!cart_id || !quantity) {
          return res.status(400).json({
              message: "Cart ID and quantity are required"
          });
      }

      if (quantity < 1) {
          return res.status(400).json({
              message: "Quantity must be at least 1"
          });
      }

      const cartItem = await CartItem.findByPk(cart_id);

      if (!cartItem) {
          return res.status(404).json({
              message: "Cart item not found"
          });
      }

      cartItem.quantity = quantity;
      await cartItem.save();

      return res.status(200).json({
          message: "Cart item quantity updated successfully",
          cartItem: cartItem
      });

  } catch (error) {
      console.error('Error Occure', error);
      return res.status(500).json({
          message: "Internal server error",
          error: error.message
      });
  }
});
module.exports=router;