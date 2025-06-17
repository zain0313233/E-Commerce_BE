const {User}=require('../models/User');
const supabase=require('../config/subpass');

async function authenticateToken(req,res,next){
try{
const authHeader=req.headers.authorization;
const token=authHeader && authHeader.split(" ")[1];
if(!token){
    return res.status(401).json({ 
        success: false,
        message: "Access token is required" 
      });
}
const {data:{user},error}=await supabase.auth.getUser(token);
  if (error || !user) {
      return res.status(403).json({ 
        success: false,
        message: "Invalid or expired token" 
      });
    }
const dbUser=await User.findOne({
    where: { supabase_id: user.id },
     attributes: ["id", "name", "email", "role", "is_supabase_user"]
})

    if (!dbUser) {
      return res.status(404).json({
        success: false,
        message: "User profile not found. Please complete registration.",
        supabase_user: user 
      });
    }

    
    req.user = {
      id: dbUser.id,
      supabase_id: user.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      supabase_user: user
    };

    next();
}catch(err) {
    console.error("Authentication error:", err);
    return res.status(401).json({ 
      success: false,
      message: "Authentication failed",
      error: err.message 
    });
  }
}
module.exports={
  authenticateToken
}