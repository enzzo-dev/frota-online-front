import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { DevicePlatform, NotificationPage, NotificationPreferences } from '../models';

/** The inbox, the unread badge, push registration and the notification switches. Any signed-in user. */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly api = inject(ApiClient);

  list(options: { unreadOnly?: boolean; page?: number; pageSize?: number } = {}): Observable<NotificationPage> {
    return this.api.get<NotificationPage>('/notifications', {
      unreadOnly: options.unreadOnly ?? false,
      page: options.page ?? 1,
      pageSize: options.pageSize ?? 20,
    });
  }

  unreadCount(): Observable<{ unread: number }> {
    return this.api.get<{ unread: number }>('/notifications/unread-count');
  }

  markRead(id: string): Observable<void> {
    return this.api.post<void>(`/notifications/${id}/read`);
  }

  markAllRead(): Observable<void> {
    return this.api.post<void>('/notifications/read-all');
  }

  preferences(): Observable<NotificationPreferences> {
    return this.api.get<NotificationPreferences>('/notifications/preferences');
  }

  /** Send only the switch that changes. */
  updatePreferences(change: Partial<NotificationPreferences>): Observable<NotificationPreferences> {
    return this.api.put<NotificationPreferences>('/notifications/preferences', change);
  }

  registerDevice(token: string, platform: DevicePlatform): Observable<void> {
    return this.api.put<void>('/devices', { token, platform });
  }

  unregisterDevice(token: string): Observable<void> {
    return this.api.delete<void>('/devices', { token });
  }
}
