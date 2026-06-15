"use client";

import { useState, useEffect } from "react";

type Review = {
  id: string;
  name: string;
  company: string | null;
  rating: number;
  review_text: string;
  created_at: string;
};

function Stars({ rating, size = 18 }: { rating: number; size?: number }) {
  return (
    <span className="review-stars" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} style={{ fontSize: size, color: n <= rating ? "#facc15" : "#334155" }}>
          ★
        </span>
      ))}
    </span>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <span className="review-star-picker" aria-label="Select star rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="review-star-btn"
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          style={{ color: n <= (hover || value) ? "#facc15" : "#334155" }}
        >
          ★
        </button>
      ))}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

export default function ReviewsSection() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    fetch("/api/reviews")
      .then((r) => r.json())
      .then((d) => setReviews(d.reviews ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitStatus("loading");
    setSubmitError("");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, company, rating, review_text: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setSubmitStatus("done");
      setName("");
      setCompany("");
      setRating(5);
      setText("");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitStatus("error");
    }
  }

  return (
    <section id="reviews" className="section">
      <div className="container">
        <span className="badge">Field tech reviews</span>
        <h2>What technicians are saying.</h2>
        <p>
          Real feedback from fuel system professionals using FuelTech AI Pro on the job.
        </p>

        {/* Review cards */}
        {loading ? (
          <div className="reviews-loading">Loading reviews…</div>
        ) : reviews.length === 0 ? (
          <div className="reviews-empty">
            No reviews yet — be the first to leave one below.
          </div>
        ) : (
          <div className="reviews-grid">
            {reviews.map((r) => (
              <div key={r.id} className="review-card">
                <Stars rating={r.rating} />
                <p className="review-text">&ldquo;{r.review_text}&rdquo;</p>
                <div className="review-meta">
                  <span className="review-name">{r.name}</span>
                  {r.company && <span className="review-company">{r.company}</span>}
                  <span className="review-date">{formatDate(r.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Submit form */}
        <div className="review-form-wrap">
          <h3 className="review-form-title">Leave a review</h3>

          {submitStatus === "done" ? (
            <div className="review-submit-success">
              ✓ Thank you! Your review has been submitted and will appear after a quick approval check.
            </div>
          ) : (
            <form className="review-form" onSubmit={handleSubmit}>
              <div className="review-form-row">
                <input
                  className="review-input"
                  type="text"
                  placeholder="Your name *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  required
                  disabled={submitStatus === "loading"}
                />
                <input
                  className="review-input"
                  type="text"
                  placeholder="Company (optional)"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  maxLength={80}
                  disabled={submitStatus === "loading"}
                />
              </div>

              <div className="review-rating-row">
                <span className="review-rating-label">Rating:</span>
                <StarPicker value={rating} onChange={setRating} />
                <span className="review-rating-value">{rating}/5</span>
              </div>

              <textarea
                className="review-textarea"
                placeholder="Share your experience with FuelTech AI Pro… (20–600 characters)"
                value={text}
                onChange={(e) => setText(e.target.value)}
                minLength={20}
                maxLength={600}
                rows={4}
                required
                disabled={submitStatus === "loading"}
              />
              <div className="review-char-count" style={{ color: text.length > 550 ? "#f87171" : undefined }}>
                {text.length}/600
              </div>

              {submitError && <p className="review-submit-error">{submitError}</p>}

              <button
                type="submit"
                className="button review-submit-btn"
                disabled={submitStatus === "loading"}
              >
                {submitStatus === "loading" ? "Submitting…" : "Submit Review"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
