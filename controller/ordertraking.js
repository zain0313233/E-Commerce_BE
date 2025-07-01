const express = require("express");
const fs = require("fs");
const path = require("path");
const { Readable, Transform } = require("stream");
const { pipeline } = require("stream/promises");
const { Order } = require("../models/Order");
const trackOrder = () => {
  console.log("underconstruction");
};
const getshippedOrders = async () => {
  try {
    const orders = await Order.findAll({
      order: [["ordered_at", "DESC"]]
    });
    await writeOrdersToCSVWithStream(orders);

    return orders;
  } catch (error) {
    console.error("error occurred", error);
    throw error;
  }
};
const writeOrdersToCSVWithStream = async (orders) => {
  console.log("Starting stream-based CSV export...");
  const filePath = path.join(__dirname, "..", "shippedorders.csv");

  const transformStream = new Transform({
    objectMode: true, 
    transform(order, encoding, callback) {
      console.log("Processing order:", typeof order, order?.id || 'no id');
      
      try {
        if (!this.headerWritten) {
          const headers = [
            "id", "user_id", "product_id", "quantity", 
            "shipping_address", "payment_method", "total_price", 
            "status", "ordered_at"
          ];
          this.push(headers.join(',') + '\n');
          this.headerWritten = true;
          this.countorders=0;
        }
        
        const data = order.dataValues || order;
        
        const escapeCSVValue = (value) => {
          if (value === null || value === undefined) return '';
          const str = String(value);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };
        this.countorders++;
        let orderStatus;
        if (this.countorders <=2){
         orderStatus='shipped';
        }
        else if(this.countorders <=4){
            orderStatus='processing';
        }
        else if(this.countorders<=6){
            orderStatus='delivered'
        }
        else{
            orderStatus=data.status;
        }
        const row = [
          escapeCSVValue(data.id),
          escapeCSVValue(data.user_id),
          escapeCSVValue(data.product_id),
          escapeCSVValue(data.quantity),
          escapeCSVValue(data.shipping_address),
          escapeCSVValue(data.payment_method),
          escapeCSVValue(data.total_price),
          escapeCSVValue(orderStatus),
          data.ordered_at ? escapeCSVValue(new Date(data.ordered_at).toISOString()) : ''
        ];
        
        this.push(row.join(',') + '\n');
        callback();
      } catch (err) {
        console.error('Transform error:', err);
        callback(err);
      }
    }
  });

  const writeStream = fs.createWriteStream(filePath);

  try {
    await pipeline(
      Readable.from(orders),
      transformStream,
      writeStream
    );

    console.log(`Stream CSV export completed: ${filePath}`);
    console.log(`Total orders exported: ${orders.length}`);
  } catch (error) {
    console.error('Pipeline error:', error);
  }
};
module.exports = {
  trackOrder,
  getshippedOrders
};
