const NodeCache = require("node-cache");

const cache = new NodeCache({
  stdTTL: 300,
  checkperiod: 60,
  useClones: false,
});

function invalidateProductCache(productId, userId, category) {
  try {
    cache.del(`product_${productId}`);

    const allCacheKeys = cache.keys();

    allCacheKeys.forEach((key) => {
      if (key.startsWith("products_all_") || key.startsWith("products_new_")) {
        cache.del(key);
      }

      if (userId && key.startsWith(`products_user_${userId}_`)) {
        cache.del(key);
      }

      if (
        category &&
        key.includes(`products_category_${category.toLowerCase()}`)
      ) {
        cache.del(key);
      }

      if (key.startsWith("products_tag_")) {
        cache.del(key);
      }
    });

    console.log(`Cache invalidated for product ${productId}`);
  } catch (error) {
    console.error("Error invalidating cache:", error);
  }
}

function clearAllProductCache() {
  try {
    const allKeys = cache.keys();
    const productKeys = allKeys.filter(
      (key) => key.startsWith("product_") || key.startsWith("products_")
    );

    productKeys.forEach((key) => cache.del(key));
    console.log(`Cleared ${productKeys.length} product cache entries`);
  } catch (error) {
    console.error("Error clearing all product cache:", error);
  }
}

module.exports = {
  cache,
  invalidateProductCache,
  clearAllProductCache,
};
