
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
    
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(`sha256=${expectedSignature}`)
    );
}

function generateIdempotencyKey(eventType, eventData, timestamp) {
    const content = JSON.stringify({ eventType, eventData, timestamp });
    return crypto.createHash('sha256').update(content).digest('hex');
}

module.exports = { verifySignature, generateIdempotencyKey };
        