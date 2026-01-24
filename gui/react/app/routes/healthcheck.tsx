// SPA mode - no server-side loaders
export default function Healthcheck() {
  return (
    <div className="p-4">
      <h1>Health Check</h1>
      <p>OK - {new Date().toISOString()}</p>
    </div>
  )
}
