const express = require("express");
const {User}=require('../models/User');
const { authenticateToken } = require("../middleware/auth");
const router = express.Router();
const supabase = require("../config/subpass");
const bcrypt = require('bcrypt');

router.post("/signup", async (req, res) => {
  try {
 const { email, password, name, role } = req.body;
 if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: "Email, password, and name are required"
      });
    }
    const existingUser= await User.findOne({
        where:{email:email}
    })
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists"
      });
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      user_metadata: {
        name: name
      },
      email_confirm: true 
    });

     if (authError) {
      return res.status(400).json({
        success: false,
        message: "Failed to create account",
        error: authError.message
      });
    }

    if (!authData.user) {
      return res.status(400).json({
        success: false,
        message: "Failed to create user account"
      });
    }
    const hashedpassword= await bcrypt.hash(password,10);
    const pgnewuser=await User.create({
          supabase_id: authData.user.id,
      name: name,
      email: email,
      password: hashedpassword,
      role: role || "customer",
      is_supabase_user: true,
      created_at: new Date()
    })

    return res.status(201).json({
         success: true,
      message: "Account created successfully",
      user: {
        id: pgnewuser.id,
        name: pgnewuser.name,
        email: pgnewuser.email,
        role: pgnewuser.role
      },
      session: authData.session,
      needsEmailVerification:false,
      // needsEmailVerification: !authData.session
    })


  } catch (error) {
    console.error("Some thing went Wrong", error);
  }
});

router.post('/signin', async (req, res) => {
    try {
        const { email, password } = req.body;

       
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

       
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (authError) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
                error: authError.message
            });
        }

        if (!authData.user || !authData.session) {
            return res.status(401).json({
                success: false,
                message: 'Authentication failed'
            });
        }

        
        const dbUser = await User.findOne({
            where: { supabase_id: authData.user.id },
            attributes: ['id', 'name', 'email', 'role', 'is_supabase_user']
        });

        if (!dbUser) {
           
            return res.status(404).json({
                success: false,
                message: 'User profile not found. Please contact support.',
                supabase_user: authData.user
            });
        }

        res.status(200).json({
            success: true,
            message: 'Signed in successfully',
            user: {
                id: dbUser.id,
                name: dbUser.name,
                email: dbUser.email,
                role: dbUser.role
            },
            session: authData.session,
            access_token: authData.session.access_token
        });

    } catch (error) {
        console.error('Signin error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to sign in',
            error: error.message
        });
    }
});


router.post('/signout', authenticateToken, async (req, res) => {
    try {
       
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(" ")[1];

        if (token) {
          
            const { error } = await supabase.auth.signOut(token);
            
            if (error) {
                console.error('Supabase signout error:', error);
            }
        }

        res.status(200).json({
            success: true,
            message: 'Signed out successfully'
        });

    } catch (error) {
        console.error('Signout error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to sign out',
            error: error.message
        });
    }
});
module.exports = router;
