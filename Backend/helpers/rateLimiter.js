const rateLimit = require('express-rate-limit');

const rateLimiter = rateLimit({
    windowMs: 1000, // 1 second window
    max: 12, // Limit each IP to 20 concurrent requests
    message: {
        status: false,  
        message: 'Server is busy Try . Maximum concurrent requests (20) exceeded. Please try again in a moment.',
        errorCode: 'TOO_MANY_REQUESTS'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.warn(`Rate limit reached for ${req.ip} on ${req.path}`);
        
        res.status(429).json({
            status: false,
            message: 'Server is busy. Maximum concurrent requests (20) exceeded. Please try again in a moment.',
            errorCode: 'TOO_MANY_REQUESTS'
        });
    },
    skip: (req) => {
        const bypassPaths = [
            '/health-check',
            '/metrics',
            '/socket.io'
        ];
        return bypassPaths.some(path => req.path.startsWith(path));
    },
    keyGenerator: (req) => {
        return req.ip + req.path;
    }
});

module.exports = rateLimiter;