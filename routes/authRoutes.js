const express = require("express");
const {User}=require('../models/User');
const { authenticateToken } = require("../middleware/auth");
const { 
  validate, 
  validateParams,
  signupSchema, 
  signinSchema, 
  profileUpdateSchema, 
  profileParamsSchema 
} = require('../middleware/validation');
const router = express.Router();
const supabase = require("../config/subpass");
const bcrypt = require('bcrypt');

router.post("/signup", validate(signupSchema), async (req, res) => {
  try {
    const { 
      email, 
      password, 
      name, 
      role,
      address_line_1,
      address_line_2,
      city,
      state,
      postal_code,
      country,
      phone
    } = req.body;

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
      role: role,
      address_line_1: address_line_1,
      address_line_2: address_line_2,
      city: city,
      state: state,
      postal_code: postal_code,
      country: country,
      phone: phone,
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
    })

  } catch (error) {
    console.error("Some thing went Wrong", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

router.post('/signin', validate(signinSchema), async (req, res) => {
    try {
        const { email, password } = req.body;

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

router.get('/profile/:id', authenticateToken, validateParams(profileParamsSchema), async (req, res) => {
    const userId = req.params.id || req.user.id;
    
    try{
        const user= await User.findOne({
            where: { id: userId },
            attributes: ['id', 'name', 'email', 'role', 'address_line_1', 'address_line_2', 'city', 'state', 'postal_code', 'country', 'phone']
        });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User profile not found'
            });
        }
        
        return res.status(200).json({
            success: true,
            message: 'Profile fetched successfully',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                address_line_1: user.address_line_1,
                address_line_2: user.address_line_2,
                city: user.city,
                state: user.state,
                postal_code: user.postal_code,
                country: user.country,
                phone: user.phone
            }
        });

    }catch(error){
        console.error('Error fetching profile:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch profile',
            error: error.message
        });
    }
});

router.put('/profile/:id', authenticateToken, validateParams(profileParamsSchema), validate(profileUpdateSchema), async (req, res) => {
    const userId = req.params.id;
    
    try {
        const user = await User.findOne({
            where: { id: userId }
        });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        await user.update(req.body);
        
        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                address_line_1: user.address_line_1,
                address_line_2: user.address_line_2,
                city: user.city,
                state: user.state,
                postal_code: user.postal_code,
                country: user.country,
                phone: user.phone
            }
        });
        
    } catch (error) {
        console.error('Error updating profile:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: error.message
        });
    }
});

module.exports = router;