const { User } = require("../models/User");
const supabase = require("../config/subpass");

async function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return next(new Error("Invalid token"));
    }

    const dbUser = await User.findOne({
      where: { supabase_id: data.user.id },
      attributes: ["id", "name", "email", "role"],
    });

    if (!dbUser) {
      return next(new Error("User not found"));
    }

    socket.user = {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
    };
    next();
  } catch (err) {
    next(new Error("Authentication failed"));
  }
}

module.exports = { authenticateSocket };
