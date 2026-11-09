import { useState } from 'react'

function Login() {
  // Like Signup, useState preserves form values and feedback between renders.
  // Login only needs credentials because it checks an existing user instead of creating one.
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  // async lets this submit handler await the HTTP response and its JSON body.
  async function handleSubmit(event) {
    // Keep the page loaded so the result can appear in this form.
    event.preventDefault()
    setMessage('')

    // catch provides visible feedback if the request or JSON parsing fails.
    try {
      // POST sends credentials to Express's /login route to check them against a stored user.
      // As in Signup, Content-Type identifies JSON and stringify creates the JSON request body.
      const response = await fetch('http://localhost:9000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      // Parse the response so both successful and failed logins can display the server's message.
      const data = await response.json()

      // A status outside 200-299 is a failure, even when fetch itself completed normally.
      if (!response.ok) {
        setIsError(true)
        setMessage(data.message)
        return
      }

      // This assignment only acknowledges success; it does not create a session or navigate away.
      setIsError(false)
      setMessage(data.message)
    } catch {
      setIsError(true)
      setMessage('Could not connect to the server.')
    }
  }

  return (
    <section className="form-card" aria-labelledby="login-heading">
      <h2 id="login-heading">Login</h2>
      {/* Let Express validate empty fields so its messages appear below. */}
      <form onSubmit={handleSubmit} noValidate>
        {/* value displays state, and onChange updates it as the user types, just as in Signup. */}
        <label htmlFor="login-username">Username</label>
        <input
          id="login-username"
          name="username"
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />

        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <button type="submit">Login</button>
      </form>
      {/* setMessage updates this text; isError determines which feedback style is used. */}
      <p className={isError ? 'feedback error' : 'feedback success'} role="status">
        {message}
      </p>
    </section>
  )
}

export default Login
