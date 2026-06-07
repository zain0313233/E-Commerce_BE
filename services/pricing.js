function unitPrice(product) {
  const price = parseFloat(product.price) || 0;
  const discount = parseFloat(product.discount_percentage) || 0;
  if (discount > 0) return price * (1 - discount / 100);
  return price;
}

module.exports = { unitPrice };
