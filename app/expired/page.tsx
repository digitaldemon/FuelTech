export default function ExpiredPage() {
  return (
    <div className="success-wrapper">
      <div className="success-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="FuelTech AI Pro" className="success-logo" />

        <div className="expired-icon">⏰</div>
        <h1>Subscription expired</h1>
        <p className="success-sub">
          Your annual access has ended. Renew for another year to get back into FuelTech AI Pro.
        </p>

        <a
          className="paypal-btn"
          href="https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=digitaldemon%40wskandsons.com&item_name=FuelTech+AI+Pro+Annual+Access+Renewal&amount=49.99&currency_code=USD&no_shipping=1&return=https%3A%2F%2Fwww.fueltechaipro.com%2Fpayment-success&cancel_return=https%3A%2F%2Fwww.fueltechaipro.com%2F%23pricing"
          target="_blank"
          rel="noopener noreferrer"
          style={{ marginTop: 24 }}
        >
          Renew — $49.99/year
        </a>

        <p className="expired-note">
          After renewing, email <a href="mailto:digitaldemon@wskandsons.com">digitaldemon@wskandsons.com</a> with your PayPal receipt and your username to reactivate your account.
        </p>

        <a href="/login" className="expired-back">← Back to login</a>
      </div>
    </div>
  );
}
