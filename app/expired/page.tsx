export default function ExpiredPage() {
  return (
    <div className="success-wrapper">
      <div className="success-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="FuelTech AI Pro" className="success-logo" />

        <div className="expired-icon">⏰</div>
        <h1>Subscription expired</h1>
        <p className="success-sub">
          Your access has ended. Renew below to get back into FuelTech AI Pro.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', marginTop: 24 }}>
          <a
            className="paypal-btn"
            href="https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=digitaldemon%40wskandsons.com&item_name=FuelTech+AI+Pro+Monthly+Renewal&a3=14.99&p3=1&t3=M&src=1&currency_code=USD&no_shipping=1&return=https%3A%2F%2Fwww.fueltechaipro.com%2Fpayment-success%3Fplan%3Dmonthly&cancel_return=https%3A%2F%2Fwww.fueltechaipro.com%2F%23pricing"
            target="_blank"
            rel="noopener noreferrer"
          >
            Renew — $14.99/month
          </a>
          <a
            className="paypal-btn"
            href="https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=digitaldemon%40wskandsons.com&item_name=FuelTech+AI+Pro+Annual+Access+Renewal&amount=99.00&currency_code=USD&no_shipping=1&return=https%3A%2F%2Fwww.fueltechaipro.com%2Fpayment-success%3Fplan%3Dannual&cancel_return=https%3A%2F%2Fwww.fueltechaipro.com%2F%23pricing"
            target="_blank"
            rel="noopener noreferrer"
          >
            Renew — $99/year (best value)
          </a>
        </div>

        <p className="expired-note">
          After renewing, email <a href="mailto:info@fueltechaipro.com">info@fueltechaipro.com</a> with your PayPal receipt and your username to reactivate your account.
        </p>

        <a href="/login" className="expired-back">← Back to login</a>
      </div>
    </div>
  );
}
