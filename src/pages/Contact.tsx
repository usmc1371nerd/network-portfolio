export function Contact() {
  return (
    <section>
      <h2>Contact</h2>
      <p>Feel free to contact me </p>
      <form className="simple-form">
        <label>
          Name
          <input type="text" placeholder="Your name" />
        </label>
        <label>
          Email
          <input type="email" placeholder="you@example.com" />
        </label>
        <label>
          Message
          <textarea rows={6} placeholder="How can I help?" />
        </label>
        <button type="button">Send</button>
      </form>
    </section>
  )
}
