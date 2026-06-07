const Joi = require('joi');
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { 
      abortEarly: false,
      stripUnknown: true 
    });
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message.replace(/"/g, '')
        }))
      });
    }
    
    req.body = value;
    next();
  };
};

const signupSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])')).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
    'any.required': 'Password is required'
  }),
  name: Joi.string().min(2).max(50).trim().required().messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name cannot exceed 50 characters',
    'any.required': 'Name is required'
  }),
  role: Joi.string().valid('customer', 'seller').default('customer'),
  is_seller: Joi.boolean().optional(),
  address_line_1: Joi.string().max(255).trim().allow('', null).optional(),
  address_line_2: Joi.string().max(255).trim().allow('', null).optional(),
  city: Joi.string().max(100).trim().allow('', null).optional(),
  state: Joi.string().max(100).trim().allow('', null).optional(),
  postal_code: Joi.string().max(20).trim().allow('', null).optional(),
  country: Joi.string().max(100).trim().allow('', null).default('Pakistan'),
  phone: Joi.string().pattern(/^[+]?[0-9]{10,15}$/).required().messages({
    'string.pattern.base': 'Please provide a valid phone number',
    'any.required': 'Phone is required'
  }),
  // Seller-specific fields
  shop_name: Joi.string().max(255).trim().when('role', {
    is: 'seller',
    then: Joi.required().messages({
      'any.required': 'Shop name is required for sellers'
    }),
    otherwise: Joi.optional().allow('', null)
  }),
  shop_description: Joi.string().max(1000).trim().allow('', null).optional()
});

const signinSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required'
  })
});

const buyerOnboardingSchema = Joi.object({
  address_line_1: Joi.string().min(5).max(255).trim().required(),
  address_line_2: Joi.string().max(255).trim().allow('', null).optional(),
  city: Joi.string().min(2).max(100).trim().required(),
  state: Joi.string().max(100).trim().allow('', null).optional(),
  postal_code: Joi.string().max(20).trim().allow('', null).optional(),
  country: Joi.string().min(2).max(100).trim().required(),
  phone: Joi.string().pattern(/^[+]?[0-9]{10,15}$/).optional(),
});

const sellerOnboardingSchema = Joi.object({
  shop_name: Joi.string().min(2).max(255).trim().required(),
  shop_description: Joi.string().max(1000).trim().allow('', null).optional(),
  address_line_1: Joi.string().max(255).trim().allow('', null).optional(),
  address_line_2: Joi.string().max(255).trim().allow('', null).optional(),
  city: Joi.string().max(100).trim().allow('', null).optional(),
  state: Joi.string().max(100).trim().allow('', null).optional(),
  postal_code: Joi.string().max(20).trim().allow('', null).optional(),
  country: Joi.string().max(100).trim().allow('', null).optional(),
  phone: Joi.string().pattern(/^[+]?[0-9]{10,15}$/).optional(),
});

const profileUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(50).trim().optional(),
  address_line_1: Joi.string().max(100).trim().allow('').optional(),
  address_line_2: Joi.string().max(100).trim().allow('').optional(),
  city: Joi.string().max(50).trim().allow('').optional(),
  state: Joi.string().max(50).trim().allow('').optional(),
  postal_code: Joi.string().max(20).trim().allow('').optional(),
  country: Joi.string().max(50).trim().allow('').optional(),
  phone: Joi.string().pattern(/^[+]?[0-9]{10,15}$/).allow('').optional().messages({
    'string.pattern.base': 'Please provide a valid phone number'
  })
});

const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parameters',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message.replace(/"/g, '')
        }))
      });
    }
    
    req.params = value;
    next();
  };
};

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
});

const resetPasswordSchema = Joi.object({
  password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])')).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
    'any.required': 'Password is required',
  }),
  access_token: Joi.string().required(),
  refresh_token: Joi.string().required(),
});

const profileParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required().messages({
    'number.base': 'User ID must be a number',
    'number.integer': 'User ID must be an integer',
    'number.positive': 'User ID must be positive',
    'any.required': 'User ID is required'
  })
});

module.exports = {
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
};