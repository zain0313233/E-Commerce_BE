function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user?.role) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Requires role: ${roles.join(" or ")}`,
      });
    }
    next();
  };
}

module.exports = { requireRole };
