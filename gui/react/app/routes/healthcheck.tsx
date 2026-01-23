export async function loader() {
  return Response.json({ ok: true, timestamp: new Date().toISOString() })
}

export default function Healthcheck() {
  return (
    <div className="p-4">
      <h1>Health Check</h1>
      <p>OK</p>
    </div>
  )
}
