import type { Server } from 'http'
import request from 'supertest'
import app from '../../src/app'

// One server per test file, bound to 127.0.0.1. `request(app)` starts a server per request
// listening on `::` but connects to 127.0.0.1, so another local process already holding that
// IPv4 port can answer instead (seen as random 401/404s and flaky concurrency tests).
let server: Server | undefined

beforeAll((done) => {
  server = app.listen(0, '127.0.0.1', done)
})

afterAll((done) => {
  if (server) {
    server.close(done)
  } else {
    done()
  }
})

export function api() {
  if (!server) {
    throw new Error('Test server is not running: call api() inside a test or hook')
  }
  return request(server)
}
