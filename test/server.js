import hapi from 'hapi'
import Knex from 'knex'
import inert from 'inert'
import { knexSnakeCaseMappers } from 'objection'
import db from '../db.json'
import { createModels } from '..'
import { createResourceRouteOptions } from '../apiutils'
import { toTitleCase } from '../helpers'

const knex = Knex({
  client: 'mysql2',
  connection: {
    host: '127.0.0.1',
    user: 'root',
    password: 'Babble01',
    database: 'stoneware'
  }
  // ,
  // ...knexSnakeCaseMappers()
})

async function createServer () {
  // Create the hapi server
  const server = hapi.server({
    port: 3004,
    routes: {
      cors: true
    }
  })

  await server.register(inert)

  server.ext('onPreResponse', (request, h) => {
    const response = request.response

    if (response.isBoom) {
      // An error was raised during
      // processing the request
      const statusCode = response.output.statusCode

      console.error({
        statusCode: statusCode,
        data: response.data,
        message: response.message
      })
    }
    return h.continue
  })

  const models = await createModels(db, knex)

  db.tables.forEach(table => {
    const name = table.name
    const Model = models[toTitleCase(name)]
    const routes = createResourceRouteOptions({ name, Model })
    server.route(routes)
  })

  server.route({
    method: 'get',
    path: '/db',
    handler: {
      file: 'db.json'
    }
  })

  server.route({
    method: 'get',
    path: '/db',
    handler: {
      file: 'db.json'
    }
  })

  server.start()

  return server
}

createServer()
