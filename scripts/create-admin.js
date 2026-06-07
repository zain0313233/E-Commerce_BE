#!/usr/bin/env node
/**
 * Create or upgrade a platform admin account (Supabase + Postgres).
 *
 * Usage:
 *   node scripts/create-admin.js
 *   ADMIN_EMAIL=x@y.com ADMIN_PASSWORD=secret node scripts/create-admin.js
 */
require("dotenv").config();
const bcrypt = require("bcrypt");
const { User } = require("../models/User");
const supabase = require("../config/subpass");
const { testConnection } = require("../database/index");

const EMAIL = process.env.ADMIN_EMAIL || "zain.ali.cs.dev@gmail.com";
const PASSWORD = process.env.ADMIN_PASSWORD || "ZainAdmin731@";
const NAME = process.env.ADMIN_NAME || "Platform Admin";

async function main() {
  await testConnection();

  let existing = await User.findOne({ where: { email: EMAIL } });

  if (existing?.role === "admin" && existing.supabase_id) {
    console.log(`Admin already exists: ${EMAIL} (id=${existing.id})`);
    return;
  }

  let supabaseId = existing?.supabase_id;

  if (!supabaseId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      user_metadata: { name: NAME, role: "admin" },
      email_confirm: true,
    });

    if (error) {
      if (error.message?.includes("already been registered")) {
        const { data: signIn } = await supabase.auth.signInWithPassword({
          email: EMAIL,
          password: PASSWORD,
        });
        if (signIn?.user?.id) {
          supabaseId = signIn.user.id;
          console.log("Linked existing Supabase user.");
        } else {
          throw new Error(
            `User exists in Supabase but sign-in failed: ${signIn?.error?.message || error.message}`
          );
        }
      } else {
        throw error;
      }
    } else {
      supabaseId = data.user.id;
    }
  }

  const hashed = await bcrypt.hash(PASSWORD, 10);

  if (existing) {
    await existing.update({
      role: "admin",
      name: NAME,
      supabase_id: supabaseId,
      is_supabase_user: true,
      profile_complete: true,
      password: hashed,
    });
    console.log(`Upgraded user to admin: ${EMAIL} (id=${existing.id})`);
  } else {
    existing = await User.create({
      supabase_id: supabaseId,
      name: NAME,
      email: EMAIL,
      password: hashed,
      role: "admin",
      is_supabase_user: true,
      profile_complete: true,
      created_at: new Date(),
    });
    console.log(`Created admin: ${EMAIL} (id=${existing.id})`);
  }

  console.log("\nSign in at the storefront login, then open /admin");
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: (see ADMIN_PASSWORD or script default)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
