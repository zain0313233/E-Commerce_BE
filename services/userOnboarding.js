function hasBuyerShippingAddress(user) {
  return Boolean(
    user?.address_line_1?.trim() &&
      user?.city?.trim() &&
      user?.country?.trim()
  );
}

function hasSellerShopReady(user) {
  return Boolean(user?.shop_name?.trim());
}

function isProfileComplete(user) {
  if (user?.role === "admin") return true;
  if (user?.role === "seller") {
    return hasSellerShopReady(user);
  }
  if (user?.role === "customer") {
    return hasBuyerShippingAddress(user);
  }
  return false;
}

function getPostAuthPath(user) {
  if (!user) return "/login";
  if (user.role === "admin") return "/admin";
  if (!isProfileComplete(user)) {
    return user.role === "seller" ? "/onboarding/seller" : "/onboarding/buyer";
  }
  if (user.role === "seller") return "/dashboard";
  if (user.role === "customer") return "/buyer";
  return "/allproducts";
}

function toPublicUser(dbUser) {
  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role,
    phone: dbUser.phone,
    address_line_1: dbUser.address_line_1,
    address_line_2: dbUser.address_line_2,
    city: dbUser.city,
    state: dbUser.state,
    postal_code: dbUser.postal_code,
    country: dbUser.country,
    shop_name: dbUser.shop_name,
    shop_description: dbUser.shop_description,
    shop_logo_url: dbUser.shop_logo_url,
    seller_verified: dbUser.seller_verified,
    profile_complete: isProfileComplete(dbUser),
  };
}

module.exports = {
  hasBuyerShippingAddress,
  hasSellerShopReady,
  isProfileComplete,
  getPostAuthPath,
  toPublicUser,
};
