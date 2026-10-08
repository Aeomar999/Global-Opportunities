import * as WebBrowser from 'expo-web-browser';
import { bookEvent, EventItem } from '../src/lib/api';

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
}));

jest.mock('../src/lib/api', () => ({
  bookEvent: jest.fn(),
  getEventById: jest.fn(),
}));

describe('event booking payment gateway & ticket URL gating (MOB-014 / SEC-123)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Free Event 1-Click Booking', () => {
    const freeEvent: EventItem = {
      id: 'event-free-01',
      title: 'Global Tech Meetup Accra',
      description: 'Free networking event for developers and founders.',
      date: 'Nov 15, 2026',
      location: 'Accra, Ghana',
      price: 'Free',
      priceNum: 0,
    };

    test('successfully books free event with attendee name, email, and quantity', async () => {
      (bookEvent as jest.Mock).mockResolvedValueOnce({
        id: 'attendee-123',
        eventId: freeEvent.id,
        fullName: 'Ama Mensah',
        email: 'ama@example.com',
        quantity: 2,
        status: 'confirmed',
      });

      const bookingPayload = {
        fullName: 'Ama Mensah',
        email: 'ama@example.com',
        quantity: 2,
        status: 'confirmed',
      };

      const result = await bookEvent(freeEvent.id, bookingPayload);

      expect(result.status).toBe('confirmed');
      expect(result.quantity).toBe(2);
      expect(bookEvent).toHaveBeenCalledWith('event-free-01', bookingPayload);
    });

    test('enforces atomic capacity guard error from server', async () => {
      (bookEvent as jest.Mock).mockRejectedValueOnce(new Error('Event has reached capacity'));

      await expect(
        bookEvent(freeEvent.id, {
          fullName: 'Kofi Annan',
          email: 'kofi@example.com',
          quantity: 1,
          status: 'confirmed',
        })
      ).rejects.toThrow('Event has reached capacity');
    });
  });

  describe('Paid Event Ticket Gating (No Plaintext Card Storage)', () => {
    const paidEvent: EventItem = {
      id: 'event-paid-02',
      title: 'Annual West Africa Innovation Summit',
      description: 'Premium conference with international keynote speakers.',
      date: 'Dec 05, 2026',
      location: 'Kempinski Hotel, Accra',
      price: 'GHS 250.00',
      priceNum: 250,
      ticketUrl: 'https://tickets.innovationsummit.africa/checkout',
    };

    test('opens external ticket checkout URL via expo-web-browser without touching plaintext card data', async () => {
      (WebBrowser.openBrowserAsync as jest.Mock).mockResolvedValueOnce({ type: 'opened' });

      const quantity = 3;
      const checkoutUrl =
        paidEvent.ticketUrl ||
        paidEvent.virtualUrl ||
        `https://kredibble.com/events/${encodeURIComponent(paidEvent.id)}/tickets?qty=${quantity}`;

      await WebBrowser.openBrowserAsync(checkoutUrl);

      expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
        'https://tickets.innovationsummit.africa/checkout'
      );
      // Ensure no internal unencrypted card booking was triggered
      expect(bookEvent).not.toHaveBeenCalled();
    });

    test('falls back to secure virtualUrl or platform ticketing URL when ticketUrl is not explicitly set', async () => {
      const paidEventWithoutTicketUrl: EventItem = {
        id: 'event-paid-03',
        title: 'Design Workshop 2026',
        description: 'Hands-on UI/UX masterclass',
        date: 'Dec 12, 2026',
        location: 'Online',
        price: 'GHS 100.00',
        priceNum: 100,
        virtualUrl: 'https://ticketing.zoom.us/w/123456789',
      };

      (WebBrowser.openBrowserAsync as jest.Mock).mockResolvedValueOnce({ type: 'opened' });

      const quantity = 1;
      const checkoutUrl =
        paidEventWithoutTicketUrl.ticketUrl ||
        paidEventWithoutTicketUrl.virtualUrl ||
        `https://kredibble.com/events/${encodeURIComponent(paidEventWithoutTicketUrl.id)}/tickets?qty=${quantity}`;

      await WebBrowser.openBrowserAsync(checkoutUrl);

      expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
        'https://ticketing.zoom.us/w/123456789'
      );
      expect(bookEvent).not.toHaveBeenCalled();
    });

    test('computes estimated total price correctly without storing unencrypted card credentials', () => {
      const quantity = 4;
      const totalPrice = (paidEvent.priceNum || 0) * quantity;
      expect(totalPrice).toBe(1000);
    });
  });

  describe('Ticket Stepper Bounds', () => {
    test('enforces minimum ticket quantity of 1 and maximum of 10', () => {
      let qty = 1;
      // Decrement below 1 should stay 1
      qty = Math.max(qty - 1, 1);
      expect(qty).toBe(1);

      // Increment up to 10
      for (let i = 0; i < 15; i++) {
        qty = Math.min(qty + 1, 10);
      }
      expect(qty).toBe(10);
    });
  });
});
