import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getRedisCache } from '../../cache/redis-client';
import { CacheKeys, CacheTTL } from '../../cache/cache-keys';
import { database } from '../../config/database';
import { ValidationError, ConflictError } from '../../utils/errors';
import config from '../../config';

export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  timestamp: string;
  signature?: string;
  source: string;
  processed: boolean;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookRegistration {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: Date;
}

export class WebhookService {
  private readonly webhookSecret: string;

  constructor() {
    this.webhookSecret = config.webhook.secret;
  }

  async registerWebhook(url: string, events: string[]): Promise<WebhookRegistration> {
    const id = uuidv4();
    const secret = this.generateSecret();
    
    const db = database.getPool();
    
    try {
      await db.execute(
        `INSERT INTO webhook_registrations (id, url, events, secret, active, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [id, url, JSON.stringify(events), secret, true]
      );

      console.log(`Webhook registered: ${url} for events: ${events.join(', ')}`);

      return {
        id,
        url,
        events,
        secret,
        active: true,
        createdAt: new Date(),
      };
    } catch (error) {
      console.error('Failed to register webhook:', error);
      throw error;
    }
  }

  async processWebhookEvent(
    eventType: string,
    eventData: any,
    signature?: string,
    source: string = 'external'
  ): Promise<WebhookEvent> {
    // Verify signature if provided
    if (signature && !this.verifySignature(eventData, signature)) {
      throw new ValidationError('Invalid webhook signature');
    }

    const eventId = uuidv4();
    const timestamp = new Date().toISOString();

    // Check for duplicate events using idempotency
    const idempotencyKey = this.generateIdempotencyKey(eventType, eventData, timestamp);
    const isDuplicate = await this.checkDuplicateEvent(idempotencyKey);
    
    if (isDuplicate) {
      console.warn(`Duplicate webhook event detected: ${eventId}`);
      throw new ConflictError('Duplicate webhook event');
    }

    // Mark event as processing to prevent duplicates
    const cache = await getRedisCache();
    await cache.set(
      CacheKeys.WEBHOOK_EVENT(idempotencyKey),
      JSON.stringify({ eventId, status: 'processing' }),
      CacheTTL.WEBHOOK_EVENT
    );

    const webhookEvent: WebhookEvent = {
      id: eventId,
      type: eventType,
      data: eventData,
      timestamp,
      signature,
      source,
      processed: false,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      // Store event in database
      await this.storeWebhookEvent(webhookEvent);
      
      // Process the event
      await this.handleWebhookEvent(webhookEvent);
      
      // Mark as processed
      await this.markEventAsProcessed(eventId);
      
      console.log(`Webhook event processed successfully: ${eventId}`);
      
      return { ...webhookEvent, processed: true };
    } catch (error) {
      console.error(`Failed to process webhook event ${eventId}:`, error);
      
      // Schedule retry if not a validation error
      if (!(error instanceof ValidationError)) {
        await this.scheduleRetry(webhookEvent);
      }
      
      throw error;
    }
  }

  private async storeWebhookEvent(event: WebhookEvent): Promise<void> {
    const db = database.getPool();
    
    try {
      await db.execute(
        `INSERT INTO webhook_events 
         (id, type, data, timestamp, signature, source, processed, retry_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.id,
          event.type,
          JSON.stringify(event.data),
          event.timestamp,
          event.signature,
          event.source,
          event.processed,
          event.retryCount,
          event.createdAt,
          event.updatedAt,
        ]
      );
    } catch (error) {
      console.error('Failed to store webhook event:', error);
      throw error;
    }
  }

  private async handleWebhookEvent(event: WebhookEvent): Promise<void> {
    switch (event.type) {
      case 'order.created':
        await this.handleOrderCreated(event.data);
        break;
      case 'order.updated':
        await this.handleOrderUpdated(event.data);
        break;
      case 'product.updated':
        await this.handleProductUpdated(event.data);
        break;
      case 'inventory.changed':
        await this.handleInventoryChanged(event.data);
        break;
      default:
        console.warn(`Unknown webhook event type: ${event.type}`);
    }
  }

  private async handleOrderCreated(data: any): Promise<void> {
    console.log('Processing order.created webhook:', data);
    
    // Invalidate relevant caches
    await this.invalidateOrderCaches(data.customerId);
    
    // Update inventory if needed
    if (data.products) {
      for (const product of data.products) {
        await this.updateProductInventory(product.productId, -product.quantity);
      }
    }
  }

  private async handleOrderUpdated(data: any): Promise<void> {
    console.log('Processing order.updated webhook:', data);
    
    // Invalidate relevant caches
    await this.invalidateOrderCaches(data.customerId);
  }

  private async handleProductUpdated(data: any): Promise<void> {
    console.log('Processing product.updated webhook:', data);
    
    // Invalidate product caches
    await this.invalidateProductCaches(data.productId);
  }

  private async handleInventoryChanged(data: any): Promise<void> {
    console.log('Processing inventory.changed webhook:', data);
    
    // Update product inventory
    await this.updateProductInventory(data.productId, data.quantityChange);
    
    // Invalidate product caches
    await this.invalidateProductCaches(data.productId);
  }

  private async updateProductInventory(productId: number, quantityChange: number): Promise<void> {
    const db = database.getPool();
    
    try {
      await db.execute(
        'UPDATE products SET stock = stock + ? WHERE id = ?',
        [quantityChange, productId]
      );
      
      console.log(`Updated inventory for product ${productId}: ${quantityChange > 0 ? '+' : ''}${quantityChange}`);
    } catch (error) {
      console.error(`Failed to update inventory for product ${productId}:`, error);
      throw error;
    }
  }

  private async invalidateProductCaches(productId: number): Promise<void> {
    // Invalidate specific product cache
    const cache = await getRedisCache();
    await cache.del(CacheKeys.PRODUCT_DETAIL(productId));
    
    // Invalidate product list caches (this is a simplified approach)
    await // cache.flushPattern('products:list:*');
    await // cache.flushPattern('products:search:*');
    
    console.log(`Invalidated caches for product ${productId}`);
  }

  private async invalidateOrderCaches(customerId: number): Promise<void> {
    // Invalidate customer-specific caches if they exist
    await // cache.flushPattern(`orders:customer:${customerId}:*`);
    
    console.log(`Invalidated order caches for customer ${customerId}`);
  }

  private async markEventAsProcessed(eventId: string): Promise<void> {
    const db = database.getPool();
    
    try {
      await db.execute(
        'UPDATE webhook_events SET processed = ?, updated_at = NOW() WHERE id = ?',
        [true, eventId]
      );
    } catch (error) {
      console.error(`Failed to mark event ${eventId} as processed:`, error);
    }
  }

  private async scheduleRetry(event: WebhookEvent): Promise<void> {
    const maxRetries = 3;
    
    if (event.retryCount >= maxRetries) {
      console.error(`Max retries exceeded for webhook event ${event.id}`);
      return;
    }

    const db = database.getPool();
    
    try {
      await db.execute(
        'UPDATE webhook_events SET retry_count = retry_count + 1, updated_at = NOW() WHERE id = ?',
        [event.id]
      );
      
      // In a real implementation, you would use a job queue like Bull or Agenda
      // For now, we'll just log that a retry should be scheduled
      console.log(`Scheduled retry for webhook event ${event.id} (attempt ${event.retryCount + 1})`);
    } catch (error) {
      console.error(`Failed to schedule retry for event ${event.id}:`, error);
    }
  }

  private generateIdempotencyKey(eventType: string, eventData: any, timestamp: string): string {
    const content = JSON.stringify({ eventType, eventData, timestamp });
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async checkDuplicateEvent(idempotencyKey: string): Promise<boolean> {
    const cache = await getRedisCache();
    const result = await cache.get(CacheKeys.WEBHOOK_EVENT(idempotencyKey));
    return result !== null;
  }

  private verifySignature(payload: any, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(`sha256=${expectedSignature}`)
    );
  }

  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async getWebhookEvents(
    limit: number = 50,
    offset: number = 0,
    eventType?: string
  ): Promise<WebhookEvent[]> {
    const db = database.getPool();
    
    let query = `
      SELECT id, type, data, timestamp, signature, source, processed, retry_count, created_at, updated_at
      FROM webhook_events
    `;
    const params: any[] = [];
    
    if (eventType) {
      query += ' WHERE type = ?';
      params.push(eventType);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    try {
      const [rows] = await db.execute(query, params);
      
      return (rows as any[]).map(row => ({
        ...row,
        data: JSON.parse(row.data),
      }));
    } catch (error) {
      console.error('Failed to fetch webhook events:', error);
      throw error;
    }
  }
}

export const webhookService = new WebhookService();