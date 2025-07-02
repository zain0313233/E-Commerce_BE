const express = require("express");
const fs = require("fs");
const path = require("path");
const { Readable, Transform } = require("stream");
const { pipeline } = require("stream/promises");
const { Order } = require("../models/Order");
const { error } = require("console");
const { headers } = require("../config/subpass");
const parseCSVLine = (line) => {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
};
const trackOrder = () => {
  try {
    const filePath =
      "C:\\Users\\HP\\Documents\\App Development\\My Projects\\E-Commerce_BE\\shippedorders.csv";

    if (!fs.existsSync(filePath)) {
      console.log("there is no csv file at ", filePath);
      return;
    }
    const result = fs.createReadStream(filePath, {
      encoding: "utf8",
      highWaterMark: 16 * 1024
    });
    let csvdata = "";
    result.on("data", (chunk) => {
      console.log("data is ", chunk);
      csvdata += chunk;
    });
    result.on("end", async () => {
      console.log("csv data loded compleatly");
      const lines = csvdata.split("\n").filter((line) => line.trim());
      const headers = parseCSVLine(lines[0]).map((headers) => headers.trim());
      console.log("header are", headers);
      const dataobject = [];
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const row = parseCSVLine(lines[i]);
          const rowobject = {};
          headers.forEach((headers, index) => {
            let value = row[index];
            if (value.startsWith('"') && value.endsWith('"')) {
              value = value.slice(1, -1);
            }
            rowobject[headers] = value;
          });
          dataobject.push(rowobject);
        }
      }
      console.log("All data as objects:", dataobject);
      if (dataobject) {
        let upadtecout = 0;
        let notFoundCount = 0;
        for (const csvorder of dataobject) {
          try {
            const order = await Order.findByPk(csvorder.id);
            if (!order) {
              notFoundCount++;
            } else {
              const updatedata = {
                status: csvorder.status
              };
              await order.update(updatedata);
              upadtecout++;
            }
          } catch (error) {
            console.error(`Error updating order ID: ${csvorder.id}`, error);
          }

          console.log(`Database update completed:`);
          console.log(`- Orders updated: ${upadtecout}`);
          console.log(`- Orders not found: ${notFoundCount}`);
          console.log(`- Total CSV records processed: ${dataobject.length}`);
        }
      }
    });
    result.on("error", (error) => {
      console.error("Stream error:", error);
    });
  } catch (error) {
    console.error("error occure ", error);
  }
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
      console.log("Processing order:", typeof order, order?.id || "no id");

      try {
        if (!this.headerWritten) {
          const headers = [
            "id",
            "user_id",
            "product_id",
            "quantity",
            "shipping_address",
            "payment_method",
            "total_price",
            "status",
            "ordered_at"
          ];
          this.push(headers.join(",") + "\n");
          this.headerWritten = true;
          this.countorders = 0;
        }

        const data = order.dataValues || order;

        const escapeCSVValue = (value) => {
          if (value === null || value === undefined) return "";
          const str = String(value);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };
        this.countorders++;
        let orderStatus;
        if (this.countorders <= 2) {
          orderStatus = "shipped";
        } else if (this.countorders <= 4) {
          orderStatus = "processing";
        } else if (this.countorders <= 6) {
          orderStatus = "delivered";
        } else {
          orderStatus = data.status;
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
          data.ordered_at
            ? escapeCSVValue(new Date(data.ordered_at).toISOString())
            : ""
        ];

        this.push(row.join(",") + "\n");
        callback();
      } catch (err) {
        console.error("Transform error:", err);
        callback(err);
      }
    }
  });

  const writeStream = fs.createWriteStream(filePath);

  try {
    await pipeline(Readable.from(orders), transformStream, writeStream);

    console.log(`Stream CSV export completed: ${filePath}`);
    console.log(`Total orders exported: ${orders.length}`);
  } catch (error) {
    console.error("Pipeline error:", error);
  }
};
module.exports = {
  trackOrder,
  getshippedOrders
};
