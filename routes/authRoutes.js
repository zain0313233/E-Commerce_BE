const express = require("express");
const { User } = require("../models/User");
const { authenticateToken } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const {
  validate,
  validateParams,
  signupSchema,
  signinSchema,
  buyerOnboardingSchema,
  sellerOnboardingSchema,
  profileUpdateSchema,
  profileParamsSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../middleware/validation");
const {
  getPostAuthPath,
  toPublicUser,
  isProfileComplete,
} = require("../services/userOnboarding");
const router = express.Router();
const supabase = require("../config/subpass");
const bcrypt = require("bcrypt");

const profileAttributes = [
  "id",
  "name",
  "email",
  "role",
  "phone",
  "address_line_1",
  "address_line_2",
  "city",
  "state",
  "postal_code",
  "country",
  "shop_name",
  "shop_description",
  "shop_logo_url",
  "seller_verified",
  "profile_complete",
];

router.post("/signup", validate(signupSchema), async (req, res) => {
  try {
    const {
      email,
      password,
      name,
      role: bodyRole,
      is_seller,
      phone,
      shop_name,
    } = req.body;

    const role =
      is_seller === true || bodyRole === "seller" ? "seller" : "customer";

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    if (role === "seller" && !shop_name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Shop name is required when registering as a seller",
      });
    }

    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        user_metadata: { name, role },
        email_confirm: true,
      });

    if (authError || !authData.user) {
      return res.status(400).json({
        success: false,
        message: "Failed to create account",
        error: authError?.message,
      });
    }

    const hashedpassword = await bcrypt.hash(password, 10);
    const pgnewuser = await User.create({
      supabase_id: authData.user.id,
      name,
      email,
      password: hashedpassword,
      role,
      phone: phone || null,
      is_supabase_user: true,
      created_at: new Date(),
      shop_name: role === "seller" ? shop_name.trim() : null,
      shop_description: null,
      seller_verified: false,
      seller_rating: null,
      total_sales: 0,
      profile_complete: false,
    });

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });

    const publicUser = toPublicUser(pgnewuser);
    const onboardingPath = getPostAuthPath(pgnewuser);

    return res.status(201).json({
      success: true,
      message:
        role === "seller"
          ? "Seller account created. Complete your shop profile next."
          : "Account created. Complete your profile for faster checkout.",
      user: publicUser,
      access_token: signInError ? null : signInData?.session?.access_token,
      refresh_token: signInError ? null : signInData?.session?.refresh_token,
      onboardingPath,
      needsOnboarding: !isProfileComplete(pgnewuser),
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

router.post("/signin", validate(signinSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (authError || !authData.user || !authData.session) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const dbUser = await User.findOne({
      where: { supabase_id: authData.user.id },
    });

    if (!dbUser) {
      return res.status(404).json({
        success: false,
        message: "User profile not found. Please contact support.",
      });
    }

    const publicUser = toPublicUser(dbUser);

    res.status(200).json({
      success: true,
      message: "Signed in successfully",
      user: publicUser,
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
      redirectPath: getPostAuthPath(dbUser),
      needsOnboarding: !isProfileComplete(dbUser),
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to sign in",
    });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        message: "refresh_token is required",
      });
    }

    const { data, error } = await supabase.auth.refreshSession({ refresh_token });
    if (error || !data?.session || !data?.user) {
      return res.status(403).json({
        success: false,
        message: "Session expired. Please sign in again.",
      });
    }

    const dbUser = await User.findOne({
      where: { supabase_id: data.user.id },
      attributes: profileAttributes,
    });

    if (!dbUser) {
      return res.status(404).json({
        success: false,
        message: "User profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      user: toPublicUser(dbUser),
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      redirectPath: getPostAuthPath(dbUser),
    });
  } catch (error) {
    console.error("refresh error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to refresh session",
    });
  }
});

router.get("/me", authenticateToken, async (req, res) => {
  try {
    const dbUser = await User.findByPk(req.user.id, {
      attributes: profileAttributes,
    });
    if (!dbUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    return res.status(200).json({
      success: true,
      user: toPublicUser(dbUser),
      redirectPath: getPostAuthPath(dbUser),
    });
  } catch (error) {
    console.error("me error:", error);
    return res.status(500).json({ success: false, message: "Failed to load user" });
  }
});

router.post(
  "/onboarding/buyer",
  authenticateToken,
  requireRole("customer"),
  validate(buyerOnboardingSchema),
  async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      await user.update({
        ...req.body,
        profile_complete: true,
      });
      const updated = await User.findByPk(req.user.id, {
        attributes: profileAttributes,
      });
      return res.status(200).json({
        success: true,
        message: "Profile completed",
        user: toPublicUser(updated),
        redirectPath: "/buyer",
      });
    } catch (error) {
      console.error("buyer onboarding", error);
      return res.status(500).json({ success: false, message: "Update failed" });
    }
  }
);

router.post(
  "/onboarding/seller",
  authenticateToken,
  requireRole("seller"),
  validate(sellerOnboardingSchema),
  async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      await user.update({
        ...req.body,
        profile_complete: true,
      });
      const updated = await User.findByPk(req.user.id, {
        attributes: profileAttributes,
      });
      return res.status(200).json({
        success: true,
        message: "Shop profile saved",
        user: toPublicUser(updated),
        redirectPath: "/dashboard",
      });
    } catch (error) {
      console.error("seller onboarding", error);
      return res.status(500).json({ success: false, message: "Update failed" });
    }
  }
);

router.post("/onboarding/skip", authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (user.role === "seller") {
      return res.status(400).json({
        success: false,
        message: "Sellers must complete shop onboarding before accessing the dashboard.",
      });
    }
    if (user.role !== "customer") {
      return res.status(400).json({
        success: false,
        message: "Onboarding skip is not available for this account.",
      });
    }
    const updated = await User.findByPk(req.user.id, {
      attributes: profileAttributes,
    });
    return res.status(200).json({
      success: true,
      message: "You can shop now. Complete your address anytime in buyer settings for faster checkout.",
      user: toPublicUser(updated),
      redirectPath: "/allproducts",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Skip failed" });
  }
});

router.post("/forgot-password", validate(forgotPasswordSchema), async (req, res) => {
  try {
    const { email } = req.body;
    const redirectTo = `${process.env.NEXT_PUBLIC_DOMAIN || "http://localhost:3000"}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      console.error("forgot-password:", error.message);
    }

    return res.status(200).json({
      success: true,
      message:
        "If an account exists for that email, you will receive a password reset link shortly.",
    });
  } catch (error) {
    console.error("forgot-password error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not process request. Try again later.",
    });
  }
});

router.post("/reset-password", validate(resetPasswordSchema), async (req, res) => {
  try {
    const { password, access_token, refresh_token } = req.body;

    if (!process.env.SUPABASE_ANON_KEY) {
      return res.status(500).json({
        success: false,
        message: "Password reset is not configured (missing SUPABASE_ANON_KEY).",
      });
    }

    const { createClient } = require("@supabase/supabase-js");
    const userClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: sessionData, error: sessionError } =
      await userClient.auth.setSession({
        access_token,
        refresh_token,
      });

    if (sessionError || !sessionData?.user) {
      return res.status(400).json({
        success: false,
        message: "Reset link expired or invalid. Request a new one.",
      });
    }

    const { error: updateError } = await userClient.auth.updateUser({
      password,
    });

    if (updateError) {
      return res.status(400).json({
        success: false,
        message: updateError.message || "Could not update password",
      });
    }

    const dbUser = await User.findOne({
      where: { supabase_id: sessionData.user.id },
    });
    if (dbUser) {
      const hashed = await bcrypt.hash(password, 10);
      await dbUser.update({ password: hashed });
    }

    return res.status(200).json({
      success: true,
      message: "Password updated. You can sign in with your new password.",
    });
  } catch (error) {
    console.error("reset-password error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  }
});

router.post("/signout", authenticateToken, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];
    if (token) {
      await supabase.auth.signOut(token);
    }
    res.status(200).json({ success: true, message: "Signed out successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to sign out" });
  }
});

router.get(
  "/profile/:id",
  authenticateToken,
  validateParams(profileParamsSchema),
  async (req, res) => {
    if (String(req.user.id) !== String(req.params.id)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    try {
      const user = await User.findByPk(req.params.id, {
        attributes: profileAttributes,
      });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User profile not found",
        });
      }
      return res.status(200).json({
        success: true,
        user: toPublicUser(user),
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch profile",
      });
    }
  }
);

router.put(
  "/profile/:id",
  authenticateToken,
  validateParams(profileParamsSchema),
  validate(profileUpdateSchema),
  async (req, res) => {
    if (String(req.user.id) !== String(req.params.id)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      const allowed = { ...req.body };
      delete allowed.role;
      delete allowed.email;
      delete allowed.seller_verified;
      delete allowed.profile_complete;
      await user.update(allowed);
      const updated = await User.findByPk(req.params.id, {
        attributes: profileAttributes,
      });
      return res.status(200).json({
        success: true,
        user: toPublicUser(updated),
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to update profile",
      });
    }
  }
);

module.exports = router;
