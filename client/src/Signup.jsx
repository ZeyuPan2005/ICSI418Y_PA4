import { useState } from 'react'

function Signup({ onRegistered }) {
  // useState remembers a value between renders; its setter updates it and asks React to render again.
  // Empty strings make each input start blank while React keeps track of what the user types.
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  // Feedback is state too: message supplies the text, and isError selects its success/error styling.
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  // onSubmit calls this when the form is submitted, including with Enter.
  // async allows await to wait for the server and its JSON without freezing the page.
  async function handleSubmit(event) {
    // Stop the browser from reloading the page so React can submit and display feedback here.
    event.preventDefault()
    // Clear the previous result while this request is being processed.
    setMessage('')

    // Network failures or unreadable JSON can throw; catch turns them into visible feedback.
    try {
      // fetch sends an HTTP request to Express; this URL matches its POST /signup route.
      const response = await fetch('http://localhost:9000/signup', {
        // POST sends data for creating a user, rather than requesting an existing page.
        method: 'POST',
        // Tell Express that the request body contains JSON so its JSON middleware can parse it.
        headers: { 'Content-Type': 'application/json' },
        // HTTP sends text here, so stringify converts this JavaScript object into JSON.
        // These keys match req.body on the server: firstName becomes f_name, lastName becomes l_name.
        // username and password already have the names the backend expects.
        body: JSON.stringify({
          f_name: firstName,
          l_name: lastName,
          username,
          password,
        }),
      })
      // Read and parse the response body into an object so we can use the server's message.
      const data = await response.json()

      // ok means an HTTP status from 200 to 299. fetch does not throw just because it gets 400/500.
      // Handle failure statuses here and return before reaching the success feedback below.
      if (!response.ok) {
        setIsError(true)
        setMessage(data.message)
        return
      }

      setIsError(false)
      setMessage(data.message)
      onRegistered?.()
    } catch {
      setIsError(true)
      setMessage('Could not connect to the server.')
    }
  }

  return (
    <section className="form-card" aria-labelledby="signup-heading">
      <h2 id="signup-heading">Signup</h2>
      {/* Let Express validate empty fields so its messages appear below. */}
      <form onSubmit={handleSubmit} noValidate>
        {/* Controlled inputs display state through value; onChange saves each edit back into state. */}
        <label htmlFor="signup-f_name">First Name</label>
        <input
          id="signup-f_name"
          name="f_name"
          type="text"
          autoComplete="given-name"
          required
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
        />

        <label htmlFor="signup-l_name">Last Name</label>
        <input
          id="signup-l_name"
          name="l_name"
          type="text"
          autoComplete="family-name"
          required
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
        />

        <label htmlFor="signup-username">Username</label>
        <input
          id="signup-username"
          name="username"
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />

        <label htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <button type="submit">Signup</button>
      </form>
      {/* State updates show the result here; role="status" lets assistive technology announce it. */}
      <p className={isError ? 'feedback error' : 'feedback success'} role="status">
        {message}
      </p>
    </section>
  )
}

export default Signup
