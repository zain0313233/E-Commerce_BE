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
  role: Joi.string().valid('customer', 'admin', 'vendor').default('customer'),
  address_line_1: Joi.string().max(100).trim().allow('').default(''),
  address_line_2: Joi.string().max(100).trim().allow('').default(''),
  city: Joi.string().max(50).trim().allow('').default(''),
  state: Joi.string().max(50).trim().allow('').default(''),
  postal_code: Joi.string().max(20).trim().allow('').default(''),
  country: Joi.string().max(50).trim().allow('').default(''),
  phone: Joi.string().pattern(/^[+]?[0-9]{10,15}$/).allow('').default('').messages({
    'string.pattern.base': 'Please provide a valid phone number'
  })
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
  profileUpdateSchema,
  profileParamsSchema
};