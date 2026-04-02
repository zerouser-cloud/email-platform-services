import { Notification } from '../../../domain/entities/notification.entity';

export interface NotificationSenderPort {
  send(notification: Notification): Promise<void>;
}
