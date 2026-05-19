const rateLimit=require('express-rate-limit');
exports.aiRateLimiter=rateLimit({windowMs:60*60*1000,max:20,keyGenerator:(req)=>req.user?.id?.toString()||req.ip,message:{error:'Too many AI requests. Limit: 20 per hour.'},standardHeaders:true,legacyHeaders:false});
exports.generalLimiter=rateLimit({windowMs:15*60*1000,max:200,message:{error:'Too many requests.'}});
